import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { formatDuration } from '@/utils/format';

export function MiniPlayer() {
  const { track, isPlaying, progress, currentSec, pause, resume, next, prev } = usePlayerStore();
  const { navigate } = useUIStore();

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-[84px] left-3 right-3 z-40
                     bg-surface2 border border-accent/20 rounded-[18px]
                     backdrop-blur-2xl overflow-hidden"
          onClick={() => navigate('track', { id: track.id })}
        >
          {/* Progress bar at top */}
          <div className="h-[2px] bg-white/10 w-full">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #7C3AFF, #FF3A8C)',
              }}
            />
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Cover */}
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center
                         text-base flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}
            >
              {track.coverUrl ? (
                <img src={track.coverUrl} alt="" className="w-full h-full rounded-[10px] object-cover" />
              ) : '🎵'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[11px] text-white truncate">
                {track.title}
              </div>
              <div className="text-[10px] text-white/50 truncate">
                {track.artist.user.name}
              </div>
            </div>

            {/* Time */}
            <span className="font-mono text-[10px] text-white/35 flex-shrink-0">
              {formatDuration(currentSec)}
            </span>

            {/* Controls */}
            <div
              className="flex items-center gap-2 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="text-lg text-white/50 leading-none bg-transparent border-none cursor-pointer"
                onClick={() => prev()}
              >⏮</button>

              <button
                className="w-8 h-8 rounded-[10px] bg-accent flex items-center
                           justify-center text-[13px] text-white border-none cursor-pointer
                           active:scale-90 transition-transform"
                onClick={() => isPlaying ? pause() : resume()}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <button
                className="text-lg text-white/50 leading-none bg-transparent border-none cursor-pointer"
                onClick={() => next()}
              >⏭</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
