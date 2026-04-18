import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { chartsApi, artistsApi } from '@/api/client';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { TrackCard } from '@/components/track/TrackCard';
import { formatDuration, formatChange, formatNumber } from '@/utils/format';

export function HomeScreen() {
  const { navigate } = useUIStore();
  const { track: currentTrack, isPlaying, progress, currentSec,
          pause, resume, play } = usePlayerStore();

  const { data: hotChart } = useQuery({
    queryKey: ['charts', 'hot', 'RU', '24h'],
    queryFn: () => chartsApi.getHot({ region: 'RU', period: '24h' }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: artists } = useQuery({
    queryKey: ['artists', 'top'],
    queryFn: () => artistsApi.getTop(8).then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: newChart } = useQuery({
    queryKey: ['charts', 'new'],
    queryFn: () => chartsApi.getNew({ region: 'RU' }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const entries = hotChart?.entries || [];
  const nowPlaying = entries[0];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-3
                      sticky top-0 bg-bg/85 backdrop-blur-xl z-10">
        <span className="font-display font-black text-[20px] text-gradient">
          Pokayfu
        </span>
        <div className="flex gap-2.5">
          <button className="w-[38px] h-[38px] rounded-[12px] bg-surface2 border border-white/10
                             flex items-center justify-center text-[17px] cursor-pointer
                             active:scale-90 transition-transform border-none">
            🔔
          </button>
          <button
            className="w-[38px] h-[38px] rounded-[12px] bg-surface2 border border-white/10
                       flex items-center justify-center text-[17px] cursor-pointer
                       active:scale-90 transition-transform border-none"
            onClick={() => navigate('profile')}
          >
            👤
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>

        {/* NOW PLAYING CARD */}
        {nowPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-5 rounded-[24px] p-[18px] relative overflow-hidden cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #1A0A3E 0%, #0D1A3A 60%, #0A1A2E 100%)',
              border: '1px solid rgba(124,58,255,0.25)',
            }}
            onClick={() => navigate('track', { id: nowPlaying.track.id })}
          >
            {/* Glows */}
            <div className="absolute w-[200px] h-[200px] rounded-full top-[-60px] right-[-40px] pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(124,58,255,0.3) 0%, transparent 70%)' }} />
            <div className="absolute w-[140px] h-[140px] rounded-full bottom-[-40px] left-[-20px] pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(255,58,140,0.2) 0%, transparent 70%)' }} />

            <div className="text-[10px] font-semibold text-white/35 uppercase tracking-[2px] mb-3">
              ▶ СЕЙЧАС ИГРАЕТ
            </div>

            <div className="flex items-center gap-3.5 mb-3.5 relative z-10">
              {/* Cover */}
              <div
                className="w-[62px] h-[62px] rounded-[16px] flex items-center justify-center
                           text-[26px] flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)',
                  boxShadow: '0 8px 24px rgba(124,58,255,0.4)',
                  animation: 'coverPulse 3s ease-in-out infinite',
                }}
              >
                {nowPlaying.track.coverUrl
                  ? <img src={nowPlaying.track.coverUrl} className="w-full h-full rounded-[16px] object-cover" alt="" />
                  : '🎵'}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[14px] text-white mb-1 truncate">
                  {nowPlaying.track.title}
                </div>
                <div className="text-[12px] text-white/50 mb-1.5">
                  {nowPlaying.track.artist.user.name}
                </div>
                <div className="pill-accent3">
                  🔒 {nowPlaying.track.trackToken?.currentPriceTon || '0.000001'} TON
                </div>
              </div>
              {/* Play btn */}
              <button
                className="w-[46px] h-[46px] rounded-full bg-accent flex items-center
                           justify-center text-[18px] text-white flex-shrink-0
                           active:scale-90 transition-transform border-none cursor-pointer"
                style={{ boxShadow: '0 4px 16px rgba(124,58,255,0.5)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTrack?.id === nowPlaying.track.id && isPlaying) {
                    pause();
                  } else {
                    play(nowPlaying.track as any, 'preview');
                  }
                }}
              >
                {currentTrack?.id === nowPlaying.track.id && isPlaying ? '⏸' : '▶'}
              </button>
            </div>

            {/* Progress */}
            <div className="relative z-10">
              <div className="h-[3px] bg-white/10 rounded-full mb-1.5">
                <div
                  className="h-full rounded-full relative"
                  style={{
                    width: currentTrack?.id === nowPlaying.track.id ? `${progress}%` : '0%',
                    background: 'linear-gradient(90deg, #7C3AFF, #FF3A8C)',
                    transition: 'width 0.5s',
                  }}
                >
                  <div className="absolute right-[-4px] top-[-4px] w-[11px] h-[11px]
                                  rounded-full bg-white"
                       style={{ boxShadow: '0 0 8px rgba(124,58,255,0.6)' }} />
                </div>
              </div>
              <div className="flex justify-between font-mono text-[10px] text-white/35">
                <span>{currentTrack?.id === nowPlaying.track.id ? formatDuration(currentSec) : '0:00'}</span>
                <span>{formatDuration(nowPlaying.track.durationSec || 0)}</span>
              </div>
            </div>

            {/* Buy row */}
            <div
              className="flex items-center justify-between mt-3 pt-3 relative z-10
                         bg-white/5 border border-white/10 rounded-[14px] px-3.5 py-2.5"
              onClick={(e) => { e.stopPropagation(); navigate('buy', { id: nowPlaying.track.id }); }}
            >
              <div>
                <div className="text-[10px] text-white/35">Цена токена</div>
                <div className="font-mono font-bold text-[14px] text-accent3">
                  {nowPlaying.track.trackToken?.currentPriceTon || '0.000001'} TON
                </div>
                <div className="text-[10px] text-green-400">
                  {formatChange(nowPlaying.track.trackToken?.priceChange24h || 0)}
                </div>
              </div>
              <div className="px-4 py-2 bg-accent rounded-[10px] font-display font-bold text-[11px] text-white">
                Купить
              </div>
            </div>
          </motion.div>
        )}

        {/* TRENDING */}
        <div className="flex items-center justify-between px-5 mb-3">
          <span className="font-display font-bold text-[13px] text-white">🔥 Трендовые</span>
          <button
            className="text-[11px] text-accent font-semibold bg-transparent border-none cursor-pointer"
            onClick={() => useUIStore.getState().setTab('charts')}
          >
            Все →
          </button>
        </div>
        <div className="flex gap-3 px-5 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {entries.slice(0, 6).map((entry, i) => (
            <TrackCard
              key={entry.track.id}
              track={entry.track as any}
              rank={entry.rank}
              variant="card"
              index={i}
              plays24h={entry.plays24h}
              tokenChange={entry.tokenChange}
            />
          ))}
          {entries.length === 0 && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[148px] h-[200px] bg-surface rounded-[20px] animate-pulse flex-shrink-0" />
          ))}
        </div>

        {/* ARTISTS */}
        <div className="flex items-center justify-between px-5 mt-4 mb-3">
          <span className="font-display font-bold text-[13px] text-white">👥 Артисты</span>
          <button
            className="text-[11px] text-accent font-semibold bg-transparent border-none cursor-pointer"
            onClick={() => useUIStore.getState().setTab('artists')}
          >
            Все →
          </button>
        </div>
        <div className="flex gap-4 px-5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {(artists || []).map((artist: any, i: number) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0
                         active:scale-90 transition-transform"
              onClick={() => navigate('artist', { id: artist.id })}
            >
              <div
                className="w-[58px] h-[58px] rounded-full flex items-center justify-center
                           text-[24px] border-2"
                style={{
                  background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)',
                  borderColor: i === 0 ? '#7C3AFF' : 'rgba(255,255,255,0.1)',
                }}
              >
                {artist.user.avatarUrl
                  ? <img src={artist.user.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  : '👤'}
              </div>
              <span className="text-[10px] font-semibold text-white/60 text-center max-w-[60px] truncate">
                {artist.user.name}
              </span>
            </motion.div>
          ))}
          {!artists && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-[58px] h-[58px] rounded-full bg-surface animate-pulse" />
              <div className="w-12 h-2 bg-surface rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* NEW TRACKS */}
        <div className="flex items-center justify-between px-5 mt-4 mb-2">
          <span className="font-display font-bold text-[13px] text-white">✨ Новинки</span>
          <button
            className="text-[11px] text-accent font-semibold bg-transparent border-none cursor-pointer"
            onClick={() => useUIStore.getState().setTab('charts')}
          >
            Все →
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4">
          {(newChart?.entries || []).slice(0, 5).map((entry: any, i: number) => (
            <TrackCard
              key={entry.track.id}
              track={entry.track}
              rank={entry.rank}
              rankChange={entry.prevRank === null ? null : entry.rank - (entry.prevRank || entry.rank)}
              variant="horizontal"
              index={i}
              plays24h={entry.plays24h}
              tokenChange={entry.tokenChange}
            />
          ))}
          {!newChart && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[70px] bg-surface rounded-2xl animate-pulse mx-0" />
          ))}
        </div>
        <div className="h-5" />
      </div>
    </div>
  );
}
