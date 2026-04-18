import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';

export function Toast() {
  const { toast, toastType } = useUIStore();

  const colors = {
    success: { bg: 'rgba(0,229,176,0.15)', border: 'rgba(0,229,176,0.3)',  text: '#00E5B0' },
    error:   { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', text: '#F87171' },
    info:    { bg: 'rgba(124,58,255,0.15)', border: 'rgba(124,58,255,0.3)',  text: '#A78BFA' },
  };

  const c = colors[toastType];

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast}
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0,  x: '-50%' }}
          exit={{    opacity: 0, y: 10, x: '-50%' }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-36 left-1/2 z-[9999] px-5 py-3 rounded-2xl
                     font-display font-bold text-[11px] whitespace-nowrap
                     backdrop-blur-2xl"
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
