'use client';

import { useWebSocket } from '@/lib/ws/use-websocket';

interface Props {
  token: string | null;
}

/**
 * Single mount point for the WebSocket connection. Rendered once
 * inside the AppShell so the connection follows the user for the
 * lifetime of their authenticated session.
 */
export function WsBootstrap({ token }: Props) {
  useWebSocket({ token, enabled: Boolean(token) });
  return null;
}
