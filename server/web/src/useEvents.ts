import { useEffect, useState } from "react";
import type { SessionEvent } from "@remote-screen/shared";

/**
 * Subscribes to the server SSE stream. EventSource auto-reconnects; each
 * (re)connection also fires onSync so the caller can pull a full snapshot —
 * the event stream is not guaranteed complete across disconnects.
 */
export function useSessionEvents(
  onEvent: (e: SessionEvent) => void,
  onSync: () => void,
): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => {
      setConnected(true);
      onSync();
    };
    source.onmessage = (msg) => onEvent(JSON.parse(msg.data as string) as SessionEvent);
    source.onerror = () => setConnected(false);
    return () => source.close();
    // Handlers intentionally bound once per mount; they close over stable setState dispatchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return connected;
}
