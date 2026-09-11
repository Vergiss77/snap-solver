import { invoke } from "@tauri-apps/api/core";

export interface ClientConfig {
  serverHost: string;
  serverPort: number;
  hotkey: string;
}

export interface ClientState {
  config: ClientConfig;
  hotkeyActive: boolean;
  screenPermission: boolean;
  platform: string;
}

export const getState = () => invoke<ClientState>("get_state");
export const saveConfig = (config: ClientConfig) => invoke<ClientState>("save_config", { config });
export const testConnection = (host: string, port: number) =>
  invoke<string>("test_connection", { host, port });
