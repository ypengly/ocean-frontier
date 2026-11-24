import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore.ts';
import { wsUrl } from '../api/client.ts';
import { remotes, subRuntime } from '../game/world.ts';

let socket: WebSocket | null = null;

export function sendDiscovery(targetId: string, name: string) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'discovery', targetId, name }));
}

/** Connects to the expedition room when a room code and account are set. Sends pose at 10 Hz. */
export function useMultiplayer() {
  const room = useGameStore((s) => s.mp.room);
  const token = useGameStore((s) => s.auth.token);
  const playing = useGameStore((s) => s.screen === 'playing');

  useEffect(() => {
    if (!room || !token || !playing) return;
    const { setMp, notify, reveal } = useGameStore.getState();
    setMp({ status: 'connecting', error: null, peers: [] });
    const ws = new WebSocket(wsUrl(room, token));
    socket = ws;
    let poseTimer: number | undefined;
    const names = new Map<string, string>();

    ws.onopen = () => {
      setMp({ status: 'online' });
      poseTimer = window.setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'pose', x: subRuntime.x, y: subRuntime.y, z: subRuntime.z, yaw: subRuntime.yaw, pitch: subRuntime.pitch, speed: subRuntime.speed }));
      }, 100);
    };
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(ev.data as string); } catch { return; }
      const id = String(m.id ?? '');
      switch (m.type) {
        case 'welcome': {
          const peers = (m.peers as { id: string; name: string }[]) ?? [];
          peers.forEach((p) => names.set(p.id, p.name));
          setMp({ peers });
          break;
        }
        case 'join': {
          const name = String(m.name ?? 'Diver');
          names.set(id, name);
          useGameStore.setState((s) => ({ mp: { ...s.mp, peers: [...s.mp.peers.filter((p) => p.id !== id), { id, name }] } }));
          notify(`${name} joined the expedition`, 'info');
          break;
        }
        case 'leave': {
          remotes.delete(id);
          useGameStore.setState((s) => ({ mp: { ...s.mp, peers: s.mp.peers.filter((p) => p.id !== id) } }));
          break;
        }
        case 'pose': {
          let r = remotes.get(id);
          if (!r) {
            const x = Number(m.x), y = Number(m.y), z = Number(m.z);
            r = { id, name: names.get(id) ?? 'Diver', x, y, z, yaw: Number(m.yaw), pitch: Number(m.pitch), tx: x, ty: y, tz: z, tyaw: Number(m.yaw), tpitch: Number(m.pitch), speed: 0, seen: true };
            remotes.set(id, r);
          }
          r.tx = Number(m.x); r.ty = Number(m.y); r.tz = Number(m.z); r.tyaw = Number(m.yaw); r.tpitch = Number(m.pitch); r.speed = Number(m.speed);
          break;
        }
        case 'discovery': {
          notify(`${String(m.from)} discovered ${String(m.name)}. Marked on your sonar.`, 'info');
          reveal(String(m.targetId));
          break;
        }
      }
    };
    ws.onerror = () => setMp({ status: 'error', error: 'Could not connect to the expedition room.' });
    ws.onclose = () => { if (useGameStore.getState().mp.status === 'online') setMp({ status: 'off' }); };

    return () => {
      if (poseTimer) clearInterval(poseTimer);
      ws.onclose = null;
      ws.close();
      socket = null;
      remotes.clear();
      useGameStore.getState().setMp({ status: 'off', peers: [] });
    };
  }, [room, token, playing]);
}
