import { useEffect, useState } from "react";
import { getState, saveConfig, testConnection, type ClientState } from "./ipc.ts";
import { HotkeyRecorder } from "./HotkeyRecorder.tsx";

export function App(): React.JSX.Element {
  const [state, setState] = useState<ClientState | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(17890);
  const [hotkeys, setHotkeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void getState().then((s) => {
      setState(s);
      setHost(s.config.serverHost);
      setPort(s.config.serverPort);
      setHotkeys(s.config.hotkeys);
    });
  }, []);

  if (!state) return <p className="muted">加载中…</p>;

  const save = async (): Promise<void> => {
    const list = [...new Set(hotkeys.map((h) => h.trim()).filter((h) => h.length > 0))];
    if (list.length === 0) {
      setNotice("至少保留一个快捷键");
      return;
    }
    try {
      const next = await saveConfig({ serverHost: host, serverPort: port, hotkeys: list });
      setState(next);
      setHotkeys(next.config.hotkeys);
      const failed = next.hotkeys.filter((h) => !h.active);
      if (failed.length > 0) {
        setNotice(`已保存，但 ${failed.length} 个快捷键未生效：${failed.map((f) => f.error ?? f.hotkey).join("；")}`);
      } else {
        setNotice("已保存，快捷键已生效");
      }
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
      <h1>Snap Solver 客户端</h1>
      {notice && <p className="notice">{notice}</p>}

      <h2>截图快捷键</h2>
      {hotkeys.map((h, i) => {
        const st = state.hotkeys.find((x) => x.hotkey === h);
        return (
          <div className="hotkey-row" key={i}>
            <HotkeyRecorder
              value={h}
              onChange={(v) => setHotkeys((prev) => prev.map((x, j) => (j === i ? v : x)))}
              onInvalid={setNotice}
            />
            {st && (
              <span className={st.active ? "status-mark ok" : "status-mark warn"} title={st.error ?? undefined}>
                <span className="dot" />
                {st.active ? "生效中" : "未生效"}
              </span>
            )}
            <button
              className="btn-icon"
              title="删除此快捷键"
              disabled={hotkeys.length <= 1}
              onClick={() => setHotkeys((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="btn-add" onClick={() => setHotkeys((prev) => [...prev, ""])}>
        + 添加快捷键
      </button>
      <p className="muted hint">不带修饰键的单键仅支持 F1–F12、PrintScreen、ScrollLock、Pause、Insert</p>

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
        <button className="btn-primary" onClick={() => void save()}>保存配置</button>
      </div>

      <h2>系统权限</h2>
      {state.platform === "macos" ? (
        <>
          <span className={state.screenPermission ? "status-mark ok" : "status-mark warn"}>
            <span className="dot" />
            屏幕录制权限：{state.screenPermission ? "已授予" : "未授予"}
          </span>
          {!state.screenPermission && (
            <p className="muted">请在 系统设置 → 隐私与安全性 → 屏幕录制 中允许本应用，并重启客户端</p>
          )}
        </>
      ) : (
        <span className="status-mark ok">
          <span className="dot" />
          Windows 无需额外权限
        </span>
      )}
    </div>
  );
}
