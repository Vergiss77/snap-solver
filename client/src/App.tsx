import { useEffect, useState } from "react";
import { getState, saveConfig, testConnection, type ClientState } from "./ipc.ts";
import { HotkeyRecorder } from "./HotkeyRecorder.tsx";

export function App(): React.JSX.Element {
  const [state, setState] = useState<ClientState | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(17890);
  const [hotkey, setHotkey] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void getState().then((s) => {
      setState(s);
      setHost(s.config.serverHost);
      setPort(s.config.serverPort);
      setHotkey(s.config.hotkey);
    });
  }, []);

  if (!state) return <p className="muted">加载中…</p>;

  const save = async (): Promise<void> => {
    try {
      const next = await saveConfig({ serverHost: host, serverPort: port, hotkey });
      setState(next);
      setNotice(next.hotkeyActive ? "已保存，快捷键已生效" : "已保存，但快捷键注册失败（可能被其他应用占用）");
    } catch (e) {
      setNotice(`保存失败：${String(e)}`);
    }
  };

  const test = async (): Promise<void> => {
    setTesting(true);
    try {
      setNotice(await testConnection(host, port));
    } catch (e) {
      setNotice(String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings">
      <h1>Remote Screen 客户端</h1>
      {notice && <p className="notice">{notice}</p>}

      <h2>截图快捷键</h2>
      <HotkeyRecorder value={hotkey} onChange={setHotkey} onInvalid={setNotice} />
      <p className={state.hotkeyActive ? "ok" : "warn"}>
        {state.hotkeyActive ? "全局热键运行中" : "热键未生效——保存后重试，或更换组合"}
      </p>

      <h2>服务端</h2>
      <div className="row">
        <label>
          主机
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.10" />
        </label>
        <label>
          端口
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="row">
        <button disabled={testing} onClick={() => void test()}>
          {testing ? "测试中…" : "测试连接"}
        </button>
        <button onClick={() => void save()}>保存配置</button>
      </div>

      <h2>系统权限</h2>
      {state.platform === "macos" ? (
        <p className={state.screenPermission ? "ok" : "warn"}>
          屏幕录制权限：{state.screenPermission ? "已授予" : "未授予——请在 系统设置 → 隐私与安全性 → 屏幕录制 中允许本应用，并重启客户端"}
        </p>
      ) : (
        <p className="ok">Windows 无需额外权限</p>
      )}
    </div>
  );
}
