/**
 * Tiny reconnecting WebSocket with exponential backoff.
 *
 * - Reconnects automatically on close/error.
 * - Backoff: 1s → 2s → 4s → 8s → max 30s.
 * - Resets to 1s after a successful open.
 * - `close()` stops reconnects permanently.
 */
export interface ReconnectingWsOptions {
  onMessage: (event: MessageEvent) => void;
  onOpen?: (socket: WebSocket) => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
}

export interface ReconnectingWs {
  close: () => void;
}

export function createReconnectingWs(url: string, opts: ReconnectingWsOptions): ReconnectingWs {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retries = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleReconnect() {
    if (stopped) return;
    const delay = Math.min(30_000, 1000 * Math.pow(2, retries));
    retries += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (stopped) return;
    opts.onStatus?.('connecting');
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      retries = 0;
      opts.onStatus?.('open');
      opts.onOpen?.(socket!);
    };
    socket.onmessage = opts.onMessage;
    socket.onclose = () => {
      opts.onStatus?.('closed');
      scheduleReconnect();
    };
    socket.onerror = () => {
      // Let onclose fire and trigger reconnect.
      try { socket?.close(); } catch { /* noop */ }
    };
  }

  connect();

  return {
    close() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { socket?.close(); } catch { /* noop */ }
    },
  };
}