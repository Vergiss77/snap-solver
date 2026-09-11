import { useEffect, useState } from "react";
import type { ProviderConfig, ProviderProtocol } from "@remote-screen/shared";
import { api } from "./api.ts";

interface ProviderForm {
  id?: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const EMPTY_FORM: ProviderForm = { name: "", protocol: "openai", baseUrl: "", apiKey: "", model: "" };

export function ConfigPanel(props: { port: number }): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [message, setMessage] = useState<string | null>(null);

  const [models, setModels] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);

  const reload = (): void => {
    void api.providers().then(setProviders);
    void api.settings().then((s) => setMaxConcurrency(s.maxConcurrency));
  };

  const loadModels = async (): Promise<void> => {
    setProbing(true);
    try {
      const res = await api.listModels({ protocol: form.protocol, baseUrl: form.baseUrl, apiKey: form.apiKey });
      setModels(res.models);
      setMessage(`已加载 ${res.models.length} 个模型`);
    } catch (e) {
      setMessage(`加载模型失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProbing(false);
    }
  };

  const testConn = async (): Promise<void> => {
    setProbing(true);
    try {
      const res = await api.testProvider({ protocol: form.protocol, baseUrl: form.baseUrl, apiKey: form.apiKey, model: form.model });
      setMessage(`连通正常（${res.latencyMs}ms）`);
    } catch (e) {
      setMessage(`连通性测试失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProbing(false);
    }
  };
  useEffect(reload, []);

  const saveProvider = async (): Promise<void> => {
    try {
      await api.saveProvider(form);
      setForm(EMPTY_FORM);
      setMessage("供应商已保存");
      reload();
    } catch (e) {
      setMessage(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="config">
      <h2>服务端配置</h2>
      {message && <p className="notice">{message}</p>}

      <h3>监听端口</h3>
      <p className="muted">当前端口：{props.port}（修改端口需编辑启动参数并重启服务端）</p>

      <h3>分析并发上限</h3>
      <div className="row">
        <input
          type="number"
          min={1}
          max={32}
          value={maxConcurrency}
          onChange={(e) => setMaxConcurrency(Number(e.target.value))}
        />
        <button
          onClick={() => {
            void api.saveSettings(maxConcurrency).then(() => setMessage("并发上限已生效"));
          }}
        >
          保存
        </button>
      </div>

      <h3>LLM 供应商</h3>
      <ul className="providers">
        {providers.map((p) => (
          <li key={p.id} className={p.isActive ? "active" : ""}>
            <span>
              {p.name} <code>{p.model}</code>（{p.protocol}）
            </span>
            {!p.isActive && (
              <button
                onClick={() => {
                  void api.activateProvider(p.id).then(reload);
                }}
              >
                设为生效
              </button>
            )}
            {p.isActive && <span className="badge badge-done">生效中</span>}
            <button
              onClick={() => setForm({ id: p.id, name: p.name, protocol: p.protocol, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model })}
            >
              编辑
            </button>
            <button
              onClick={() => {
                void api.deleteProvider(p.id).then(reload);
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>

      <h3>{form.id ? "编辑供应商" : "新增供应商"}</h3>
      <div className="provider-form">
        <label>
          名称
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 Kimi Code" />
        </label>
        <label>
          协议
          <select
            value={form.protocol}
            onChange={(e) => setForm({ ...form, protocol: e.target.value === "anthropic" ? "anthropic" : "openai" })}
          >
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>
          Base URL
          <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.kimi.com/coding/v1" />
        </label>
        <label>
          API Key
          <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        </label>
        <label>
          模型
          <input
            list="model-options"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="如 kimi-for-coding"
          />
          <datalist id="model-options">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <div className="row">
          <button disabled={probing} onClick={() => void loadModels()}>
            {probing ? "加载中…" : "加载模型"}
          </button>
          <button disabled={probing} onClick={() => void testConn()}>
            {probing ? "测试中…" : "测试连通性"}
          </button>
        </div>
        <div className="row">
          <button onClick={() => void saveProvider()}>保存</button>
          {form.id && <button onClick={() => setForm(EMPTY_FORM)}>取消编辑</button>}
        </div>
      </div>
    </section>
  );
}
