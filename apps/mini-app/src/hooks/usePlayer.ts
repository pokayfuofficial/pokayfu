import { useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { usePlayerStore } from '@/stores/playerStore';
import type { TrackShort } from '@pokayfu/shared-types';

/**
 * Хук аудиоплеера на базе Howler.js
 * Управляет воспроизведением треков
 */
export function usePlayer() {
  const howlRef = useRef<Howl | null>(null);
  const playIntervalRef = useRef<number | null>(null);

  const {
    track, isPlaying, volume,
    setProgress, setDuration, setLoading,
    pause, resume, next,
  } = usePlayerStore();

  // Создаём Howl при смене трека
  useEffect(() => {
    if (!track) return;

    // Останавливаем предыдущий
    if (howlRef.current) {
      howlRef.current.stop();
      howlRef.current.unload();
    }
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    setLoading(true);

    const url = (track as any)._streamUrl || `/v1/tracks/${track.id}/preview`;

    const howl = new Howl({
      src:    [url],
      html5:  true,
      volume,
      onload: () => {
        setDuration(Math.floor(howl.duration()));
        setLoading(false);
      },
      onloaderror: () => {
        setLoading(false);
        console.error('[Player] Failed to load audio');
      },
      onplay: () => {
        // Обновляем прогресс каждые 500ms
        playIntervalRef.current = setInterval(() => {
          const seek = howl.seek() as number;
          const dur  = howl.duration();
          if (dur > 0) {
            setProgress((seek / dur) * 100, Math.floor(seek));
          }
        }, 500) as unknown as number;
      },
      onpause: () => {
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
        }
      },
      onend: () => {
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
        }
        setProgress(100, Math.floor(howl.duration()));
        // Переход к следующему треку
        setTimeout(() => next(), 500);
      },
    });

    howlRef.current = howl;

    if (isPlaying) {
      howl.play();
    }

    return () => {
      howl.stop();
      howl.unload();
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [track?.id]);

  // Управление play/pause
  useEffect(() => {
    if (!howlRef.current) return;
    if (isPlaying) {
      howlRef.current.play();
    } else {
      howlRef.current.pause();
    }
  }, [isPlaying]);

  // Обновление громкости
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume);
    }
  }, [volume]);

  const seekTo = useCallback((pct: number) => {
    if (!howlRef.current) return;
    const dur = howlRef.current.duration();
    howlRef.current.seek((pct / 100) * dur);
  }, []);

  const playTrack = useCallback((t: TrackShort, streamUrl?: string) => {
    const store = usePlayerStore.getState();
    // Прикрепляем URL к объекту трека (временно)
    const trackWithUrl = { ...t, _streamUrl: streamUrl };
    store.play(trackWithUrl as any, streamUrl ? 'full' : 'preview', streamUrl);
  }, []);

  return { seekTo, playTrack };
}
