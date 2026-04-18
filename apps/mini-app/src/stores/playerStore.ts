import { create } from 'zustand';
import type { TrackShort } from '@pokayfu/shared-types';

export type PlayerMode = 'preview' | 'full';

interface PlayerState {
  // Текущий трек
  track:       TrackShort | null;
  mode:        PlayerMode;
  // Воспроизведение
  isPlaying:   boolean;
  isLoading:   boolean;
  progress:    number;       // 0-100
  currentSec:  number;
  durationSec: number;
  volume:      number;       // 0-1
  // История
  queue:       TrackShort[];
  queueIndex:  number;

  // Actions
  play:        (track: TrackShort, mode?: PlayerMode, streamUrl?: string) => void;
  pause:       () => void;
  resume:      () => void;
  stop:        () => void;
  seek:        (pct: number) => void;
  setVolume:   (v: number) => void;
  setProgress: (pct: number, sec: number) => void;
  setDuration: (sec: number) => void;
  setLoading:  (v: boolean) => void;
  next:        () => void;
  prev:        () => void;
  setQueue:    (tracks: TrackShort[], startIndex?: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  track:       null,
  mode:        'preview',
  isPlaying:   false,
  isLoading:   false,
  progress:    0,
  currentSec:  0,
  durationSec: 0,
  volume:      1,
  queue:       [],
  queueIndex:  0,

  play: (track, mode = 'preview', _streamUrl) => {
    set({ track, mode, isPlaying: true, progress: 0, currentSec: 0 });
  },

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  stop: () => set({ isPlaying: false, progress: 0, currentSec: 0, track: null }),

  seek: (pct) => {
    const { durationSec } = get();
    set({ progress: pct, currentSec: Math.floor((pct / 100) * durationSec) });
  },

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  setProgress: (pct, sec) => set({ progress: pct, currentSec: sec }),

  setDuration: (sec) => set({ durationSec: sec }),

  setLoading: (v) => set({ isLoading: v }),

  next: () => {
    const { queue, queueIndex } = get();
    if (queueIndex < queue.length - 1) {
      const next = queue[queueIndex + 1];
      set({ track: next, queueIndex: queueIndex + 1, progress: 0, currentSec: 0 });
    }
  },

  prev: () => {
    const { queue, queueIndex, currentSec } = get();
    if (currentSec > 3) {
      set({ progress: 0, currentSec: 0 });
    } else if (queueIndex > 0) {
      const prev = queue[queueIndex - 1];
      set({ track: prev, queueIndex: queueIndex - 1, progress: 0, currentSec: 0 });
    }
  },

  setQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks, queueIndex: startIndex });
    if (tracks[startIndex]) {
      set({ track: tracks[startIndex] });
    }
  },
}));
