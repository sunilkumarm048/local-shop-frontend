import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;

/**
 * Get or create the Socket.IO connection.
 * Must be called with a token after login. Calling again with the same token
 * returns the existing connection; a different token re-connects.
 */
export function getSocket(token: string | null): Socket | null {
  if (!token) {
    socket?.disconnect();
    socket = null;
    return null;
  }

  if (socket?.connected && socket.auth && (socket.auth as { token: string }).token === token) {
    return socket;
  }

  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
