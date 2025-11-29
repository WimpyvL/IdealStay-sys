import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageItem } from '../services/messages.service';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../services/api.config';

interface UseChatSocketOptions {
  conversationId?: number | null;
  onMessage?: (msg: { conversation_id: number; message: MessageItem }) => void;
  onConversationUpdate?: (payload: any) => void;
  enabled?: boolean;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseChatSocketReturn {
  connected: boolean;            // convenience flag (status === 'connected')
  status: ConnectionStatus;      // granular status
  error: string | null;
  sendTyping: () => void;        // placeholder for future
  socket: Socket | null;
}

/**
 * Hook to manage a chat websocket connection tied to a specific conversation.
 */
export function useChatSocket({ conversationId, onMessage, onConversationUpdate, enabled = true }: UseChatSocketOptions): UseChatSocketReturn {
  const { state } = useAuth();
  const token = state.token; // token stored separately in auth state
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Lazy connect
  useEffect(() => {
    if (!enabled) return;

    const computeBase = (): string => {
      // Priority: explicit socket url env, then API base env, then axios BASE_URL export
      const viteEnv = (import.meta as any)?.env || {};
      let base = viteEnv.VITE_SOCKET_URL || viteEnv.VITE_API_BASE_URL || viteEnv.VITE_API_BASE || '';
      if (!base) base = BASE_URL || '';
      if (base) {
        base = base.replace(/\/$/, '');
        // Remove /api/... tail
        base = base.replace(/\/api(\/v\d+)?($|\/.*)/, '');
      }
      if (!base) base = window.location.origin; // fallback (may be wrong port in dev)
      return base;
    };

    if (!socketRef.current) {
      setStatus('connecting');
      const base = computeBase();
      const auth: Record<string, string> = {};
      if (token) auth.token = token;
      const crossOrigin = window.location.origin !== base;
      console.debug('[chat-socket] connecting', { base, hasToken: !!token, crossOrigin });
      socketRef.current = io(base, {
        transports: ['websocket'],
        auth,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
      });
      const s = socketRef.current;
      s.on('connect', () => {
        console.debug('[chat-socket] connected', s.id);
        setConnected(true);
        setStatus('connected');
        setError(null);
        if (conversationId) s.emit('conversation:join', conversationId);
      });
      s.on('disconnect', (reason) => {
        console.debug('[chat-socket] disconnected', reason);
        setConnected(false);
        setStatus('disconnected');
      });
      s.on('connect_error', (err) => {
        console.warn('[chat-socket] connect_error', err.message);
        setError(err.message);
        setStatus('error');
      });
      s.on('conversation:joined', (payload) => {
        console.debug('[chat-socket] joined room', payload);
      });
    } else {
      const s = socketRef.current;
      const currentHasToken = !!(s.auth as any)?.token;
      if (token && !currentHasToken) {
        (s.auth as any).token = token;
        console.debug('[chat-socket] upgrading auth with token');
        if (!s.connected) {
          setStatus('connecting');
          s.connect();
        }
      }
    }
  }, [enabled, token, conversationId]);

  // Update event listeners when callbacks change
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const messageHandler = (payload: any) => { onMessage?.(payload); };
    const conversationUpdateHandler = (payload: any) => { onConversationUpdate?.(payload); };

    s.on('message:new', messageHandler);
    s.on('conversation:update', conversationUpdateHandler);

    return () => {
      s.off('message:new', messageHandler);
      s.off('conversation:update', conversationUpdateHandler);
    };
  }, [onMessage, onConversationUpdate]);

  // Handle conversation join/leave
  useEffect(() => {
    if (!socketRef.current) return;
    if (conversationId) {
      socketRef.current.emit('conversation:join', conversationId);
      return () => {
        socketRef.current?.emit('conversation:leave', conversationId);
      };
    }
  }, [conversationId]);

  const sendTyping = useCallback(() => {
    // future event
  }, []);

  return { connected, status, error, sendTyping, socket: socketRef.current };
}
