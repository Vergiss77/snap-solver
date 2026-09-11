import { useState } from "react";

const MODIFIER_KEYS: Record<string, true> = { Control: true, Shift: true, Alt: true, Meta: true };

/**
 * "Press to record" hotkey input. Captures a keydown chord and renders it as a
 * Tauri accelerator string (e.g. "CommandOrControl+Shift+S"). Bare letter keys
 * without a modifier are rejected — they cannot be global hotkeys.
 */
export function HotkeyRecorder(props: {
  value: string;
  onChange: (accelerator: string) => void;
  onInvalid: (reason: string) => void;
}): React.JSX.Element {
  const [recording, setRecording] = useState(false);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (MODIFIER_KEYS[e.key]) return; // wait for the non-modifier key
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (parts.length === 0) {
      props.onInvalid("全局快捷键必须包含修饰键（Ctrl/Shift/Alt 之一）");
      return;
    }
    parts.push(key);
    props.onChange(parts.join("+"));
    setRecording(false);
  };

  return (
    <input
      readOnly
      className={recording ? "hotkey recording" : "hotkey"}
      value={recording ? "请按下快捷键组合…" : props.value}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={onKeyDown}
    />
  );
}
