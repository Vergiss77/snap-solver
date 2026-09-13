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
 * Bare single keys (no modifier) allowed as global hotkeys: function-class keys
 * whose global hijack cannot break typing — keep in sync with SINGLE_KEY_WHITELIST in lib.rs.
 */
const SINGLE_KEY_WHITELIST: Record<string, true> = {
  F1: true, F2: true, F3: true, F4: true, F5: true, F6: true,
  F7: true, F8: true, F9: true, F10: true, F11: true, F12: true,
  PrintScreen: true, ScrollLock: true, Pause: true, Insert: true,
};

/** Display-only: accelerator "CommandOrControl" reads better as "Command/Control". */
function displayChord(accelerator: string): string {
  return accelerator.replace(/CommandOrControl/g, "Command/Control");
}

/**
 * "Press to record" hotkey input. Captures a keydown chord and renders it as a
 * Tauri accelerator string (e.g. "CommandOrControl+Shift+S"). Bare single keys
 * are accepted only from the function-key whitelist (F1–F12, PrintScreen,
 * ScrollLock, Pause, Insert); printable/editing keys need a modifier.
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
    if (parts.length === 0 && !SINGLE_KEY_WHITELIST[key]) {
      props.onInvalid("单键仅支持功能键类（F1–F12、PrintScreen、ScrollLock、Pause、Insert），其他按键请添加修饰键（Ctrl/Shift/Alt 之一）");
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
      value={recording ? "请按下快捷键组合…" : displayChord(props.value)}
      placeholder="点击此处，按下快捷键"
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
