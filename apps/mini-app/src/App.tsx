import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { BottomNav } from '@/components/ui/BottomNav';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { Toast } from '@/components/ui/Toast';
import { HomeScreen }    from '@/screens/HomeScreen';
import { ChartsScreen }  from '@/screens/ChartsScreen';
import { TrackScreen }   from '@/screens/TrackScreen';
import { BuyScreen }     from '@/screens/BuyScreen';
import { UploadScreen }  from '@/screens/UploadScreen';
import {
  LibraryScreen,
  ArtistsScreen,
  ArtistScreen,
  ProfileScreen,
} from '@/screens/OtherScreens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// ── SCREEN REGISTRY ────────────────────────────
const SCREENS: Record<string, React.ComponentType> = {
  home:     HomeScreen,
  charts:   ChartsScreen,
  artists:  ArtistsScreen,
  library:  LibraryScreen,
  profile:  ProfileScreen,
  track:    TrackScreen,
  artist:   ArtistScreen,
  buy:      BuyScreen,
  upload:   UploadScreen,
};

// ── SCREEN RENDERER ────────────────────────────
function ScreenRenderer() {
  const { currentScreen } = useUIStore();

  // Init player (must be inside provider)
  usePlayer();

  const Screen = SCREENS[currentScreen] || HomeScreen;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentScreen}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{    opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 overflow-hidden"
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  );
}

// ── AUTH GATE ──────────────────────────────────
function AppContent() {
  const { isLoading, isAuth } = useAuth();

  // Инициализация Telegram WebApp
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0A0A12');
      tg.setBackgroundColor('#0A0A12');
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-[24px] flex items-center justify-center text-[40px]"
               style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)', boxShadow: '0 0 40px rgba(124,58,255,0.4)' }}>
            🎵
          </div>
          <div className="absolute inset-[-8px] rounded-[32px] border-2 border-accent/30 animate-ping" />
        </div>
        <div className="font-display font-black text-[28px] text-gradient">Pokayfu</div>
        <div className="text-[12px] text-white/35 font-display">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* Main screen area */}
      <div className="absolute inset-0" style={{ paddingBottom: 84 }}>
        <ScreenRenderer />
      </div>

      {/* Mini player */}
      <MiniPlayer />

      {/* Bottom navigation */}
      <BottomNav />

      {/* Toast */}
      <Toast />
    </div>
  );
}

// ── ROOT APP ───────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-screen overflow-hidden bg-bg text-white noise">
        <AppContent />
      </div>
    </QueryClientProvider>
  );
}
