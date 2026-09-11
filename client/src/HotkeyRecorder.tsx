import { useState } from "react";
import { setRecording as setHotkeySuspended } from "./ipc.ts";

const MODIFIER_KEYS: Record<string, true> = { Control: true, Shift: true, Alt: true, Meta: true };

/** OS/app-level chords that can never serve as a global trigger — keep in sync with RESERVED in lib.rs. */
const RESERVED_CHORDS: Record<string, true> = {
  "commandorcontrol+q": true, "commandorcontrol+w": true, "commandorcontrol+m": true,
  "commandorcontrol+h": true, "commandorcontrol+tab": true, "commandorcontrol+space": true,
  "alt+f4": true, "alt+tab": true, "alt+escape": true,
  "commandorcontrol+alt+delete": true,
};

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
    const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (parts.length === 0) {
      props.onInvalid("全局快捷键必须包含修饰键（Ctrl/Shift/Alt 之一）");
      return;
    }
    parts.push(key);
    const chord = parts.join("+");
    if (RESERVED_CHORDS[chord.toLowerCase()]) {
      props.onInvalid(`${chord} 与系统快捷键冲突，请换一个组合`);
      return;
    }
    props.onChange(chord);
    (e.currentTarget as HTMLInputElement).blur(); // also ends recording + resumes the global hotkey
  };

  return (
    <input
      readOnly
      className={recording ? "hotkey recording" : "hotkey"}
      value={recording ? "请按下快捷键组合…" : props.value}
      onFocus={() => {
        setRecording(true);
        void setHotkeySuspended(true);
      }}
      onBlur={() => {
        setRecording(false);
        void setHotkeySuspended(false);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
