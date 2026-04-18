import { motion } from 'framer-motion';
import type { TrackShort } from '@pokayfu/shared-types';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';
import { formatNumber, formatChange, GENRE_COLORS } from '@/utils/format';
import { cn } from '@/utils/format';

interface TrackCardProps {
  track: TrackShort;
  rank?: number;
  rankChange?: number | null;
  showMetrics?: 'music' | 'crypto' | 'both';
  variant?: 'horizontal' | 'card';
  plays24h?: number;
  tokenChange?: number;
  holderCount?: number;
  volume24h?: string;
  index?: number;
}

export function TrackCard({
  track, rank, rankChange, showMetrics = 'both',
  variant = 'horizontal', plays24h, tokenChange,
  holderCount, volume24h, index = 0,
}: TrackCardProps) {
  const { navigate } = useUIStore();
  const { play, track: currentTrack, isPlaying } = usePlayerStore();
  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying;
  const token = track.trackToken;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentlyPlaying) {
      usePlayerStore.getState().pause();
    } else {
      play(track as any, 'preview');
    }
  };

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="w-[148px] flex-shrink-0 bg-surface border border-white/[0.06]
                   rounded-[20px] overflow-hidden cursor-pointer active:scale-95
                   transition-transform duration-150"
        onClick={() => navigate('track', { id: track.id })}
      >
        {/* Cover */}
        <div
          className={cn(
            'h-[118px] flex items-center justify-center text-[40px] relative',
            `bg-gradient-to-br ${GENRE_COLORS[track.genre] || 'from-gray-800 to-gray-600'}`
          )}
        >
          {track.coverUrl
            ? <img src={track.coverUrl} className="w-full h-full object-cover absolute inset-0" alt="" />
            : '🎵'
          }
          {rank && (
            <div className="absolute top-2 left-2 w-[22px] h-[22px] rounded-[7px]
                            bg-black/55 backdrop-blur-sm flex items-center justify-center
                            font-display font-bold text-[9px] text-white">
              {rank}
            </div>
          )}
          <div className="absolute top-2 right-2 px-[7px] py-[3px] rounded-[6px]
                          bg-black/50 backdrop-blur-sm text-[9px] text-white/60">
            {track.genre.replace('_', ' ')}
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          <div className="font-display font-bold text-[11px] text-white truncate mb-0.5">
            {track.title}
          </div>
          <div className="text-[10px] text-white/50 mb-2">{track.artist.user.name}</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-[11px] text-accent3">
                {token ? `${token.currentPriceTon} TON` : '—'}
              </div>
              {token && (
                <div className={cn('text-[9px]', token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {formatChange(token.priceChange24h)}
                </div>
              )}
            </div>
            <button
              className="text-[18px] bg-transparent border-none cursor-pointer"
              onClick={handlePlay}
            >
              {isCurrentlyPlaying ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Horizontal variant (for charts)
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer
                 active:bg-white/[0.03] transition-colors"
      onClick={() => navigate('track', { id: track.id })}
    >
      {/* Rank */}
      {rank !== undefined && (
        <div className="w-7 text-center flex-shrink-0">
          <div
            className="font-display font-black text-[14px]"
            style={{ color: rank === 1 ? '#FFB800' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(240,238,249,0.35)' }}
          >
            {rank}
          </div>
          {rankChange !== undefined && rankChange !== null && (
            <div className={cn('text-[8px]', rankChange > 0 ? 'text-green-400' : rankChange < 0 ? 'text-red-400' : 'text-white/35')}>
              {rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : '—'}
            </div>
          )}
          {rankChange === null && (
            <div className="text-[8px] text-accent2">NEW</div>
          )}
        </div>
      )}

      {/* Cover */}
      <div
        className={cn(
          'w-[50px] h-[50px] rounded-[13px] flex items-center justify-center',
          'text-[22px] flex-shrink-0 relative overflow-hidden',
          `bg-gradient-to-br ${GENRE_COLORS[track.genre] || 'from-gray-800 to-gray-600'}`
        )}
      >
        {track.coverUrl && <img src={track.coverUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />}
        {isCurrentlyPlaying && (
          <div className="absolute inset-0 bg-accent/30 flex items-center justify-center text-base">▶</div>
        )}
        {!track.coverUrl && !isCurrentlyPlaying && '🎵'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-[12px] text-white truncate mb-0.5">
          {track.title}
        </div>
        <div className="text-[11px] text-white/50 mb-1">{track.artist.user.name}</div>
        <div className="flex gap-[5px] flex-wrap">
          {plays24h !== undefined && (
            <span className="metric-pill-plays">♪ {formatNumber(plays24h)}</span>
          )}
          {tokenChange !== undefined && token && (
            <span className="metric-pill-token">{formatChange(tokenChange)}</span>
          )}
          {holderCount !== undefined && (
            <span className="metric-pill-holders">💎 {formatNumber(holderCount)}</span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="text-right flex-shrink-0 min-w-[70px]">
        <div className="font-mono font-bold text-[12px] text-accent3 mb-0.5">
          {token ? `${token.currentPriceTon} TON` : '—'}
        </div>
        {token && (
          <div className={cn('text-[10px]', token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400')}>
            {formatChange(token.priceChange24h)}
          </div>
        )}
        {volume24h && (
          <div className="text-[9px] text-white/35 font-mono">{volume24h} vol</div>
        )}
      </div>
    </motion.div>
  );
}
