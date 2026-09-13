import { invoke } from "@tauri-apps/api/core";

export interface ClientConfig {
  serverHost: string;
  serverPort: number;
  hotkeys: string[];
}

export interface HotkeyStatus {
  hotkey: string;
  active: boolean;
  error: string | null;
}

export interface ClientState {
  config: ClientConfig;
  /** Per-hotkey registration status, mirroring config.hotkeys. */
  hotkeys: HotkeyStatus[];
  screenPermission: boolean;
  platform: string;
}

export const getState = () => invoke<ClientState>("get_state");
export const setRecording = (active: boolean) => invoke<void>("set_recording", { active });
export const saveConfig = (config: ClientConfig) => invoke<ClientState>("save_config", { config });
export const testConnection = (host: string, port: number) =>
  invoke<string>("test_connection", { host, port });
