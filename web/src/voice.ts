import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from './api';

export type VoiceState = 'idle' | 'connecting' | 'connected' | 'listen-only' | 'reconnecting' | 'error';

export function useVoice(houseId: string, roomId: string, enabled = true) {
  const [desired, setDesired] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [message, setMessage] = useState('Voice is optional.');
  const [attempt, setAttempt] = useState(0);
  const [needsAudio, setNeedsAudio] = useState(false);
  const liveRoom = useRef<Room | null>(null);
  const audioRoot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!desired || !enabled) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    liveRoom.current = room;
    const connected = () => {
      if (cancelled) return;
      setState('connected');
      setMessage(mutedRef.current ? 'Voice connected · muted.' : 'Voice connected.');
    };
    room.on(RoomEvent.TrackSubscribed, track => {
      if (!cancelled && track.kind === Track.Kind.Audio && audioRoot.current) audioRoot.current.appendChild(track.attach());
    });
    room.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(element => element.remove()));
    room.on(RoomEvent.Reconnecting, () => { if (!cancelled) { setState('reconnecting'); setMessage('Voice is reconnecting…'); } });
    room.on(RoomEvent.Reconnected, connected);
    room.on(RoomEvent.Disconnected, () => { if (!cancelled) { setState('error'); setMessage('Voice disconnected. Try joining again.'); } });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!cancelled) setNeedsAudio(!room.canPlaybackAudio); });
    const connect = async () => {
      setState('connecting'); setMessage('Pulling up a chair…');
      try {
        const credentials = await api.voiceToken(houseId, roomId);
        if (cancelled) return;
        await room.connect(credentials.url, credentials.token);
        if (cancelled) { await room.disconnect(); return; }
        try {
          await room.localParticipant.setMicrophoneEnabled(!mutedRef.current);
          connected();
        } catch {
          if (!cancelled) { setState('listen-only'); setMessage('Listening only. Allow microphone access to speak.'); }
        }
        if (cancelled) await room.disconnect();
      } catch (error) {
        if (!cancelled) { setState('error'); setMessage(error instanceof Error ? error.message : 'Voice could not connect.'); }
        await room.disconnect();
      }
    };
    void connect();
    return () => {
      cancelled = true;
      if (liveRoom.current === room) liveRoom.current = null;
      room.removeAllListeners();
      void room.disconnect();
      audioRoot.current?.replaceChildren();
    };
  }, [desired, houseId, roomId, enabled, attempt]);

  const join = useCallback(() => { setDesired(true); setAttempt(value => value + 1); }, []);
  const leave = useCallback(() => { setDesired(false); setState('idle'); setMessage('Voice is optional.'); setNeedsAudio(false); }, []);
  const toggleMute = useCallback(async () => {
    const room = liveRoom.current;
    if (!room) return;
    const next = state === 'listen-only' ? false : !mutedRef.current;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      mutedRef.current = next; setMuted(next); setState('connected');
      setMessage(next ? 'Voice connected · muted.' : 'Voice connected.');
    } catch { setState('listen-only'); setMessage('Listening only. Allow microphone access to speak.'); }
  }, [state]);
  const enableAudio = useCallback(async () => { try { await liveRoom.current?.startAudio(); setNeedsAudio(false); } catch { setNeedsAudio(true); } }, []);

  return { state, muted, message, desired, join, leave, toggleMute, audioRoot, needsAudio, enableAudio };
}
