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
    /// Whether the configured hotkey is currently registered.
    pub hotkey_active: bool,
    /// macOS screen-recording permission; always true elsewhere.
    pub screen_permission: bool,
    pub platform: String,
}

pub struct AppState {
    pub config: Mutex<ClientConfig>,
    pub hotkey_active: Mutex<bool>,
}

fn snapshot(state: &State<'_, AppState>) -> ClientState {
    ClientState {
        config: state.config.lock().clone(),
        hotkey_active: *state.hotkey_active.lock(),
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

fn register_hotkey(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let shortcut: Shortcut = accelerator
        .parse()
        .map_err(|_| format!("invalid accelerator: {accelerator}"))?;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let handle = app.clone();
    gs.on_shortcut(shortcut, move |_app, _shortcut, _event| {
        if _event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            trigger_capture(handle.clone());
        }
    })
    .map_err(|e| format!("register failed (occupied?): {e}"))?;
    Ok(())
}

// ---------- Tauri commands (settings window API) ----------

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> ClientState {
    snapshot(&state)
}

#[tauri::command]
fn save_config(app: AppHandle, state: State<'_, AppState>, config: ClientConfig) -> Result<ClientState, String> {
    {
        *state.config.lock() = config.clone();
    }
    let path = config_path(&app);
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    // Hot-re-register with the (possibly new) accelerator.
    let ok = register_hotkey(&app, &config.hotkey).is_ok();
    *state.hotkey_active.lock() = ok;
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
            hotkey_active: Mutex::new(false),
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

            let ok = register_hotkey(app.handle(), &config.hotkey).is_ok();
            *app.state::<AppState>().hotkey_active.lock() = ok;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_state, save_config, test_connection])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
