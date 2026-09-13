import { useEffect, useState } from "react";
import type { ProviderConfig, ProviderProtocol } from "@snap-solver/shared";
import { api } from "./api.ts";
import { setDisplayPrefs, useDisplayPrefs } from "./prefs.ts";

interface ProviderForm {
  id?: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const EMPTY_FORM: ProviderForm = { name: "", protocol: "openai", baseUrl: "", apiKey: "", model: "" };

interface Preset {
  key: string;
  label: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  model: string;
}

const PRESETS: Preset[] = [
  { key: "kimi", label: "Kimi", name: "Kimi", protocol: "openai", baseUrl: "https://api.kimi.com/coding/v1", model: "kimi-for-coding" },
  { key: "deepseek", label: "DeepSeek", name: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { key: "openai", label: "OpenAI", name: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { key: "anthropic", label: "Anthropic", name: "Anthropic", protocol: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-opus-5" },
  { key: "other", label: "其他", name: "", protocol: "openai", baseUrl: "", model: "" },
];

const CODE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "", label: "不指定" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];

/** Best-effort match of an existing provider back to a preset (by baseUrl). */
function presetKeyOf(p: ProviderForm): string {
  const hit = PRESETS.find((x) => x.key !== "other" && x.baseUrl === p.baseUrl);
  return hit?.key ?? "other";
}

export function ConfigPanel(props: { port: number }): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [preset, setPreset] = useState("kimi");
  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const displayPrefs = useDisplayPrefs();

  const [models, setModels] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);

  const reload = (): void => {
    void api.providers().then(setProviders);
    void api.settings().then((s) => {
      setMaxConcurrency(s.maxConcurrency);
      setAnalysisPrompt(s.analysisPrompt);
      setCodeLanguage(s.codeLanguage);
    });
  };

  const applyPreset = (key: string): void => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setForm((f) =>
      key === "other"
        ? { ...f, name: "", protocol: "openai", baseUrl: "", model: "" }
        : { ...f, name: p.name, protocol: p.protocol, baseUrl: p.baseUrl, model: p.model },
    );
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
      setPreset("kimi");
      setMessage("供应商已保存");
      reload();
    } catch (e) {
      setMessage(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="config">
      <div className="column">
        <h2>服务端配置</h2>
        {message && <p className="notice">{message}</p>}

        <h3>监听端口</h3>
        <p className="muted">当前端口：{props.port}（修改端口需编辑启动参数并重启服务端）</p>

        <h3>显示偏好</h3>
        <div className="prefs">
          <label className="pref">
            <input
              type="checkbox"
              checked={displayPrefs.showImage}
              onChange={(e) => setDisplayPrefs({ showImage: e.target.checked })}
            />
            显示图片
          </label>
          <label className="pref">
            <input
              type="checkbox"
              checked={displayPrefs.showQuestion}
              onChange={(e) => setDisplayPrefs({ showQuestion: e.target.checked })}
            />
            显示题干
          </label>
        </div>
        <p className="muted hint">控制答题区是否展示截图与题目描述，仅影响本浏览器的显示，不影响已保存的题目数据。</p>

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
            className="btn-primary"
            onClick={() => {
              void api.saveSettings({ maxConcurrency }).then(() => setMessage("并发上限已生效"));
            }}
          >
            保存
          </button>
        </div>

        <h3>分析提示词</h3>
        <div className="provider-form">
          <label>
            提示词（预置为当前生效的全文，可修改）
            <textarea
              rows={14}
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
            />
          </label>
          <p className="muted hint">可修改指令内容，请保留末尾的 JSON 输出结构约定，否则分析会解析失败。</p>
          <div className="row">
            <button
              className="btn-primary"
              onClick={() => {
                void api.saveSettings({ analysisPrompt }).then(() => setMessage("提示词已保存，后续新题生效"));
              }}
            >
              保存
            </button>
            <button
              onClick={() => {
                void api.saveSettings({ analysisPrompt: "" }).then((s) => {
                  setAnalysisPrompt(s.analysisPrompt);
                  setMessage("已恢复为内置默认提示词");
                });
              }}
            >
              恢复默认
            </button>
          </div>
        </div>

        <h3>编程语言</h3>
        <div className="row">
          <select value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}>
            {CODE_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={() => {
              void api.saveSettings({ codeLanguage }).then(() => setMessage("编程语言已生效"));
            }}
          >
            保存
          </button>
        </div>
        <p className="muted hint">配置后，编程题的代码实现将使用该语言。</p>

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
              {p.isActive && (
                <span className="status-mark status-done">
                  <span className="dot" />
                  生效中
                </span>
              )}
              <button
                onClick={() => {
                  const f = { id: p.id, name: p.name, protocol: p.protocol, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model };
                  setForm(f);
                  setPreset(presetKeyOf(f));
                }}
              >
                编辑
              </button>
              <button
                className="btn-danger"
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
            服务商预设
            <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
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
            <button className="btn-primary" onClick={() => void saveProvider()}>保存</button>
            {form.id && <button onClick={() => setForm(EMPTY_FORM)}>取消编辑</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
