import { useCallback, useEffect, useRef, useState } from 'react';
import type { Color, Move } from './chess';

export type Player = {
  id: string;
  name: string;
  avatar: string | null;
  tag?: string | null;
  title?: string | null;
};

export type Room = {
  code: string;
  mode: 'create' | 'join' | 'random';
  capacity: number;
  players: Player[];
  moves: Move[];
  turn: Color;
  solo?: boolean;
};

export type ServerMessage =
  | { t: 'room'; room: Room }
  | { t: 'move'; move: Move; turn: Color }
  | { t: 'searching' }
  | { t: 'left' }
  | { t: 'title'; title: string | null }
  | { t: 'chat'; id: string; from: string; text: string; at: number }
  | { t: 'notice'; message: string }
  | { t: 'error'; message: string };

type Handlers = (message: ServerMessage) => void;

/**
 * Keeps one websocket to the lobby server and reconnects if it drops.
 * Messages sent while offline are queued and flushed on the next open.
 */
export function useLobby(onMessage: Handlers) {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<string[]>([]);
  const handlerRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);

  handlerRef.current = onMessage;

  useEffect(() => {
    let disposed = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        retries = 0;
        setConnected(true);
        const queued = pendingRef.current;
        pendingRef.current = [];
        for (const raw of queued) socket.send(raw);
      };

      socket.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data as string) as ServerMessage);
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retryTimer = setTimeout(connect, Math.min(4000, 400 * 2 ** retries));
          retries += 1;
        }
      };

      socket.onerror = () => socket.close();
    };

    connect();

    // Free hosts sleep a service after 15 minutes without inbound traffic, and a
    // player sitting in a room sends nothing. A quiet ping keeps it awake while
    // anyone has the app open, and stops the moment the last tab closes.
    const wakeTimer = setInterval(() => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'ping' }));
    }, 5 * 60 * 1000);

    return () => {
      disposed = true;
      clearInterval(wakeTimer);
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: object) => {
    const raw = JSON.stringify(message);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
      return;
    }
    pendingRef.current.push(raw);
    if (pendingRef.current.length > 6) pendingRef.current.shift();
  }, []);

  return { connected, send };
}
