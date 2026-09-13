use serde::{Deserialize, Serialize};
use parking_lot::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

// ---------- persisted client configuration ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfig {
    pub server_host: String,
    pub server_port: u16,
    pub hotkeys: Vec<String>,
}

/// Accepts both the current `hotkeys: [...]` format and the legacy
/// single `hotkey: "..."` field (migrated to a one-element list).
impl<'de> Deserialize<'de> for ClientConfig {
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Raw {
            server_host: Option<String>,
            server_port: Option<u16>,
            hotkeys: Option<Vec<String>>,
            // Legacy pre-0.3 format.
            hotkey: Option<String>,
        }
        let raw = Raw::deserialize(d)?;
        let defaults = ClientConfig::default();
        let mut hotkeys = raw
            .hotkeys
            .or_else(|| raw.hotkey.map(|h| vec![h]))
            .unwrap_or_else(|| defaults.hotkeys.clone());
        if hotkeys.is_empty() {
            hotkeys = defaults.hotkeys.clone();
        }
        Ok(ClientConfig {
            server_host: raw.server_host.unwrap_or(defaults.server_host),
            server_port: raw.server_port.unwrap_or(defaults.server_port),
            hotkeys,
        })
    }
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            server_host: "127.0.0.1".into(),
            server_port: 17890,
            hotkeys: vec!["CommandOrControl+Shift+S".into()],
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
pub struct HotkeyStatus {
    pub hotkey: String,
    /// Whether this accelerator is registered and firing.
    pub active: bool,
    /// Last registration failure for this accelerator, if any.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientState {
    pub config: ClientConfig,
    /// Per-hotkey registration status, mirroring `config.hotkeys`.
    pub hotkeys: Vec<HotkeyStatus>,
    /// macOS screen-recording permission; always true elsewhere.
    pub screen_permission: bool,
    pub platform: String,
}

#[derive(Clone)]
pub struct RegisteredHotkey {
    pub accelerator: String,
    /// Live registration; None when registration failed (kept for display + retry).
    pub shortcut: Option<Shortcut>,
    pub error: Option<String>,
}

pub struct AppState {
    pub config: Mutex<ClientConfig>,
    pub registered: Mutex<Vec<RegisteredHotkey>>,
}

fn snapshot(state: &State<'_, AppState>) -> ClientState {
    let registered = state.registered.lock();
    ClientState {
        config: state.config.lock().clone(),
        hotkeys: registered
            .iter()
            .map(|r| HotkeyStatus {
                hotkey: r.accelerator.clone(),
                active: r.shortcut.is_some(),
                error: r.error.clone(),
            })
            .collect(),
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

/// Single keys (no modifier) allowed as global hotkeys: function-class keys
/// whose global hijack cannot break typing or text editing. Keep in sync with
/// SINGLE_KEY_WHITELIST in HotkeyRecorder.tsx.
const SINGLE_KEY_WHITELIST: &[&str] = &[
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    "PrintScreen", "ScrollLock", "Pause", "Insert",
];

const MODIFIER_NAMES: &[&str] = &[
    "commandorcontrol", "command", "control", "ctrl", "cmd",
    "shift", "alt", "option", "meta", "super",
];

/// A bare single key (no modifier) must be on the function-key whitelist;
/// printable/editing keys would be swallowed system-wide and break typing.
fn check_single_key_policy(accelerator: &str) -> Result<(), String> {
    let parts: Vec<&str> = accelerator.split('+').map(|p| p.trim()).filter(|p| !p.is_empty()).collect();
    let has_modifier = parts
        .iter()
        .any(|p| MODIFIER_NAMES.contains(&p.to_lowercase().as_str()));
    if has_modifier {
        return Ok(());
    }
    if parts.len() == 1 && SINGLE_KEY_WHITELIST.iter().any(|k| k.eq_ignore_ascii_case(parts[0])) {
        return Ok(());
    }
    Err(format!(
        "{accelerator} 无效：不带修饰键的单键仅支持功能键类（F1–F12、PrintScreen、ScrollLock、Pause、Insert），其他按键请添加修饰键"
    ))
}

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
    check_single_key_policy(accelerator)?;
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

/// While any recorder input is focused, suspend ALL global hotkeys so the
/// currently-registered chords reach the webview (OS routes registered
/// hotkeys to the app, not the focused window). Resumed on blur.
#[tauri::command]
fn set_recording(app: AppHandle, state: State<'_, AppState>, active: bool) {
    let mut registered = state.registered.lock();
    if active {
        for entry in registered.iter_mut() {
            if let Some(sc) = entry.shortcut.take() {
                let _ = app.global_shortcut().unregister(sc);
            }
        }
    } else {
        for entry in registered.iter_mut() {
            if entry.shortcut.is_none() {
                match try_register(&app, &entry.accelerator) {
                    Ok(sc) => {
                        entry.shortcut = Some(sc);
                        entry.error = None;
                    }
                    Err(e) => entry.error = Some(e),
                }
            }
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, state: State<'_, AppState>, mut config: ClientConfig) -> Result<ClientState, String> {
    if config.hotkeys.is_empty() {
        return Err("至少保留一个快捷键".into());
    }
    // Dedupe (case/whitespace-insensitive), preserving order.
    let mut seen = std::collections::HashSet::new();
    config.hotkeys.retain(|h| seen.insert(normalized(h)));

    // Reconcile registrations with the new list, per-key independent:
    // unchanged live registrations are kept; removed ones are unregistered;
    // new or previously-failed ones are (re-)registered. One key's failure
    // never touches the others.
    let mut registered = state.registered.lock();
    let mut kept: Vec<RegisteredHotkey> = Vec::new();
    for entry in registered.drain(..) {
        let still_wanted = config.hotkeys.iter().any(|h| normalized(h) == normalized(&entry.accelerator));
        if still_wanted && entry.shortcut.is_some() {
            kept.push(entry);
        } else if let Some(sc) = entry.shortcut {
            let _ = app.global_shortcut().unregister(sc);
        }
    }
    let mut next: Vec<RegisteredHotkey> = Vec::new();
    for accel in &config.hotkeys {
        if let Some(existing) = kept.iter().find(|e| normalized(&e.accelerator) == normalized(accel)) {
            next.push(existing.clone());
            continue;
        }
        match try_register(&app, accel) {
            Ok(sc) => next.push(RegisteredHotkey { accelerator: accel.clone(), shortcut: Some(sc), error: None }),
            Err(e) => next.push(RegisteredHotkey { accelerator: accel.clone(), shortcut: None, error: Some(e) }),
        }
    }
    *registered = next;
    drop(registered);

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
            registered: Mutex::new(Vec::new()),
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
            // macOS: background-agent form — no dock icon; the menu-bar tray is the entry point.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let config = load_config(app.handle());
            *app.state::<AppState>().config.lock() = config.clone();

            let show = MenuItem::with_id(app, "show", "打开设置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let tray = TrayIconBuilder::new()
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
                });
            // macOS: monochrome template icon — the system recolors it with the menu-bar theme.
            #[cfg(target_os = "macos")]
            let tray = tray
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template-22.png"))?)
                .icon_as_template(true);
            #[cfg(not(target_os = "macos"))]
            let tray = tray.icon(app.default_window_icon().unwrap().clone());
            tray.build(app)?;

            let mut entries: Vec<RegisteredHotkey> = Vec::new();
            for accel in &config.hotkeys {
                match try_register(app.handle(), accel) {
                    Ok(sc) => entries.push(RegisteredHotkey { accelerator: accel.clone(), shortcut: Some(sc), error: None }),
                    Err(e) => entries.push(RegisteredHotkey { accelerator: accel.clone(), shortcut: None, error: Some(e) }),
                }
            }
            *app.state::<AppState>().registered.lock() = entries;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_state, save_config, test_connection, set_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_single_hotkey_migrates_to_list() {
        let cfg: ClientConfig = serde_json::from_str(
            r#"{"serverHost":"192.168.1.5","serverPort":17890,"hotkey":"CommandOrControl+Shift+A"}"#,
        )
        .unwrap();
        assert_eq!(cfg.server_host, "192.168.1.5");
        assert_eq!(cfg.hotkeys, vec!["CommandOrControl+Shift+A".to_string()]);
    }

    #[test]
    fn new_format_loads_as_is_and_empty_falls_back() {
        let cfg: ClientConfig = serde_json::from_str(
            r#"{"serverHost":"h","serverPort":1,"hotkeys":["F5","Ctrl+Alt+Q"]}"#,
        )
        .unwrap();
        assert_eq!(cfg.hotkeys, vec!["F5".to_string(), "Ctrl+Alt+Q".to_string()]);
        let cfg: ClientConfig = serde_json::from_str(r#"{"hotkeys":[]}"#).unwrap();
        assert_eq!(cfg.hotkeys, ClientConfig::default().hotkeys);
    }

    #[test]
    fn single_key_policy() {
        assert!(check_single_key_policy("F5").is_ok());
        assert!(check_single_key_policy("PrintScreen").is_ok());
        assert!(check_single_key_policy("S").is_err());
        assert!(check_single_key_policy("Escape").is_err());
        assert!(check_single_key_policy("CommandOrControl+Shift+S").is_ok());
        assert!(check_single_key_policy("Alt+F1").is_ok());
    }
}
