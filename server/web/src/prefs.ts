import { useSyncExternalStore } from "react";

/** 答题区显示偏好：仅存 localStorage，纯前端展示开关，不影响服务端数据。 */
export interface DisplayPrefs {
  showImage: boolean;
  showQuestion: boolean;
}

const KEY = "snap-solver.displayPrefs";
const DEFAULTS: DisplayPrefs = { showImage: true, showQuestion: true };

let cache: DisplayPrefs | null = null;
const listeners = new Set<() => void>();

function load(): DisplayPrefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplayPrefs>) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setDisplayPrefs(patch: Partial<DisplayPrefs>): void {
  cache = { ...load(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

/** 跨组件共享的显示偏好（配置面板与答题区实时同步）。 */
export function useDisplayPrefs(): DisplayPrefs {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, load);
}
