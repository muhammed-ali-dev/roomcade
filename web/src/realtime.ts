import { useCallback, useEffect, useRef, useState } from 'react';
import type { HouseSnapshot } from './types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'replaced' | 'offline';

export function useHouseRealtime(houseId: string, initial?: HouseSnapshot) {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | undefined>(initial);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: number }>());

  useEffect(() => {
    if (initial) setSnapshot(current => !current || current.id !== initial.id || initial.revision > current.revision ? initial : current);
  }, [initial]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let attempts = 0;
    const rejectPending = () => {
      pending.current.forEach(command => { clearTimeout(command.timer); command.reject(new Error('Connection interrupted. Try entering the room again.')); });
      pending.current.clear();
    };
    const connect = () => {
      if (stopped) return;
      setConnection(attempts ? 'reconnecting' : 'connecting');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/api/v1/realtime?houseId=${encodeURIComponent(houseId)}`, 'roomcade.v1');
      socketRef.current = socket;
      let firstSnapshot = true;
      socket.onopen = () => { attempts = 0; socket.send(JSON.stringify({ type: 'house.enter' })); };
      socket.onmessage = event => {
        if (stopped) return;
        const message = JSON.parse(event.data);
        if (message.type === 'house.snapshot') {
          const incoming = message.data as HouseSnapshot;
          const first = firstSnapshot;
          firstSnapshot = false;
          setSnapshot(current => first || !current || incoming.revision > current.revision || (incoming.revision === current.revision && incoming.presenceVersion >= current.presenceVersion) ? incoming : current);
          setConnection('connected');
        }
        if (message.type === 'command.accepted' || message.type === 'command.rejected') {
          const command = pending.current.get(message.transitionId);
          if (command) {
            clearTimeout(command.timer); pending.current.delete(message.transitionId);
            if (message.type === 'command.accepted') command.resolve();
            else command.reject(new Error(message.error?.message ?? 'Could not enter this room.'));
          }
        }
        if (message.type === 'connection.ping') socket.send(JSON.stringify({ type: 'connection.pong' }));
        if (message.type === 'session.replaced') { stopped = true; rejectPending(); setConnection('replaced'); socket.close(); }
        if (message.type === 'membership.removed' || message.type === 'house.deleted') { stopped = true; rejectPending(); socket.close(); window.location.assign('/'); }
      };
      socket.onclose = () => {
        rejectPending();
        if (stopped) return;
        setConnection('offline'); attempts += 1;
        timer = window.setTimeout(connect, Math.min(15_000, 500 * 2 ** attempts) + Math.random() * 400);
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); rejectPending(); socketRef.current?.close(); };
  }, [houseId]);

  const switchRoom = useCallback((targetRoomId: string) => new Promise<void>((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) { reject(new Error('Wait for Roomcade to reconnect before switching rooms.')); return; }
    const transitionId = crypto.randomUUID();
    const timer = window.setTimeout(() => { pending.current.delete(transitionId); reject(new Error('Room change timed out. Try again.')); }, 10_000);
    pending.current.set(transitionId, { resolve, reject, timer });
    socket.send(JSON.stringify({ type: 'room.switch', targetRoomId, transitionId }));
  }), []);

  return { snapshot, setSnapshot, connection, switchRoom };
}
