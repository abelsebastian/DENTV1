import { useEffect, useRef, useCallback } from 'react';

/**
 * Connects to the backend WebSocket and calls onMessage with parsed events.
 * Auto-reconnects on disconnect.
 *
 * Connection strategy:
 *  - If VITE_WS_URL env var is set, use it directly.
 *  - If running on localhost (dev), connect to ws://localhost:5000 directly.
 *  - If running behind a proxy/ngrok (non-localhost), use the same host/protocol
 *    as the page so the WebSocket goes through the same tunnel.
 */
export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    let url;

    if (import.meta.env.VITE_WS_URL) {
      url = import.meta.env.VITE_WS_URL;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      url = 'ws://localhost:5000';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      url = `${protocol}://${window.location.host}`;
    }

    ws.current = new WebSocket(url);

    ws.current.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed */ }
    };

    ws.current.onerror = () => {
      // Silently ignore — onclose will trigger reconnect
    };

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
