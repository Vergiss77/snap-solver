use serde::{Deserialize, Serialize};
use parking_lot::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

// ---------- persisted client configuration ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfig {
    pub server_host: String,
    pub server_port: u16,
    pub hotkey: String,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            server_host: "127.0.0.1".into(),
            server_port: 17890,
            hotkey: "CommandOrControl+Shift+S".into(),
        }
    }
}

fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("config.json")
}

fn load_config(app: &AppHandle) -> ClientConfig {
    std::fs::read_to_string(config_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// ---------- runtime state reported to the settings window ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientState {
    pub config: ClientConfig,
    /// Whether a hotkey is currently registered and working.
    pub hotkey_active: bool,
    /// Last registration failure, if any (kept until a save succeeds).
    pub hotkey_error: Option<String>,
    /// macOS screen-recording permission; always true elsewhere.
    pub screen_permission: bool,
    pub platform: String,
}

pub struct AppState {
    pub config: Mutex<ClientConfig>,
    /// Currently registered shortcut; None when registration never succeeded.
    pub registered: Mutex<Option<Shortcut>>,
    pub hotkey_error: Mutex<Option<String>>,
}

fn snapshot(state: &State<'_, AppState>) -> ClientState {
    ClientState {
        config: state.config.lock().clone(),
        hotkey_active: state.registered.lock().is_some(),
        hotkey_error: state.hotkey_error.lock().clone(),
        screen_permission: screen_capture_permitted(),
        platform: std::env::consts::OS.into(),
    }
}


// ---------- permissions ----------

#[cfg(target_os = "macos")]
fn screen_capture_permitted() -> bool {
    core_graphics::access::ScreenCaptureAccess::default().preflight()
}

#[cfg(not(target_os = "macos"))]
fn screen_capture_permitted() -> bool {
    true
}

// ---------- capture + send ----------

/// Capture the primary monitor to PNG bytes, silently (no OS UI feedback).
fn capture_png() -> Result<Vec<u8>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("monitor enum failed: {e}"))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| "no primary monitor".to_string())?;
    let img = primary.capture_image().map_err(|e| format!("capture failed: {e}"))?;
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("png encode failed: {e}"))?;
    Ok(buf.into_inner())
}

/// POST the screenshot; any failure is silently dropped per spec.
async fn send_screenshot(host: String, port: u16) -> Result<(), String> {
    let png = capture_png()?;
    let part = reqwest::multipart::Part::bytes(png)
        .file_name("screenshot.png")
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("image", part)
        .text("clientTs", chrono_like_now());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    client
        .post(format!("http://{host}:{port}/api/screenshots"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn chrono_like_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (days, rem) = (secs / 86400, secs % 86400);
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = civil_from_days(days as i64);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn trigger_capture(app: AppHandle) {
    let (host, port) = {
        let state = app.state::<AppState>();
        let cfg = state.config.lock();
        (cfg.server_host.clone(), cfg.server_port)
    };
    // Independent task per trigger: concurrent presses never block each other.
    tauri::async_runtime::spawn(async move {
        let _ = send_screenshot(host, port).await; // offline -> silently dropped
    });
}

// ---------- hotkey registration ----------

/// OS-reserved chords that must never become our trigger (macOS app-level
/// shortcuts like Cmd+W/Q, window switching, etc.).
const RESERVED: &[&str] = &[
    "CommandOrControl+Q",
    "CommandOrControl+W",
    "CommandOrControl+M",
    "CommandOrControl+H",
    "CommandOrControl+Tab",
    "CommandOrControl+Space",
    "Alt+F4",
    "Alt+Tab",
    "Alt+Escape",
    "CommandOrControl+Alt+Delete",
];

fn normalized(accel: &str) -> String {
    accel.split('+').map(|p| p.trim().to_lowercase()).collect::<Vec<_>>().join("+")
}

/// Register WITHOUT touching the currently registered shortcut — callers swap
/// on success so a failed attempt never kills the working hotkey.
fn try_register(app: &AppHandle, accelerator: &str) -> Result<Shortcut, String> {
    let norm = normalized(accelerator);
    if RESERVED.iter().any(|r| normalized(r) == norm) {
        return Err(format!("{accelerator} 与系统快捷键冲突，请换一个组合"));
    }
    let shortcut: Shortcut = accelerator
        .parse()
        .map_err(|_| format!("无效的快捷键组合: {accelerator}"))?;
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
            if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                trigger_capture(handle.clone());
            }
        })
        .map_err(|e| format!("注册失败（可能被其他应用占用）: {e}"))?;
    Ok(shortcut)
}

// ---------- Tauri commands (settings window API) ----------

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> ClientState {
    snapshot(&state)
}

/// While the recorder input is focused, suspend the global hotkey so the
/// currently-registered chord reaches the webview (OS routes registered
/// hotkeys to the app, not the focused window). Resumed on blur.
#[tauri::command]
fn set_recording(app: AppHandle, state: State<'_, AppState>, active: bool) {
    if active {
        if let Some(sc) = state.registered.lock().take() {
            let _ = app.global_shortcut().unregister(sc);
        }
    } else if state.registered.lock().is_none() {
        let hotkey = state.config.lock().hotkey.clone();
        match try_register(&app, &hotkey) {
            Ok(sc) => *state.registered.lock() = Some(sc),
            Err(e) => *state.hotkey_error.lock() = Some(e),
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, state: State<'_, AppState>, mut config: ClientConfig) -> Result<ClientState, String> {
    // Swap hotkey first: register the new chord before dropping the old one.
    let effective_hotkey = {
        let current = state.config.lock().hotkey.clone();
        if normalized(&config.hotkey) == normalized(&current) {
            current
        } else {
            match try_register(&app, &config.hotkey) {
                Ok(new_sc) => {
                    if let Some(old) = state.registered.lock().replace(new_sc) {
                        let _ = app.global_shortcut().unregister(old);
                    }
                    *state.hotkey_error.lock() = None;
                    config.hotkey.clone()
                }
                Err(e) => {
                    // Keep the working hotkey; persist it, not the rejected one.
                    *state.hotkey_error.lock() = Some(e);
                    current
                }
            }
        }
    };
    config.hotkey = effective_hotkey;
    *state.config.lock() = config.clone();
    let path = config_path(&app);
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(snapshot(&state))
}

#[tauri::command]
async fn test_connection(host: String, port: u16) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .get(format!("http://{host}:{port}/api/health"))
        .send()
        .await
        .map_err(|e| format!("无法连接：{e}"))?;
    if !res.status().is_success() {
        return Err(format!("服务端响应异常：HTTP {}", res.status()));
    }
    let body: serde_json::Value = res.json().await.map_err(|_| "非服务端响应")?;
    Ok(format!("连接成功：{} v{}", body["name"], body["version"]))
}

// ---------- app setup ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            config: Mutex::new(ClientConfig::default()),
            registered: Mutex::new(None),
            hotkey_error: Mutex::new(None),
        })
        .on_window_event(|window, event| {
            // Closing the settings window hides it; the client stays resident in the tray.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "settings" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            let config = load_config(app.handle());
            *app.state::<AppState>().config.lock() = config.clone();

            let show = MenuItem::with_id(app, "show", "打开设置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("settings") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            match try_register(app.handle(), &config.hotkey) {
                Ok(sc) => *app.state::<AppState>().registered.lock() = Some(sc),
                Err(e) => *app.state::<AppState>().hotkey_error.lock() = Some(e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_state, save_config, test_connection, set_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
