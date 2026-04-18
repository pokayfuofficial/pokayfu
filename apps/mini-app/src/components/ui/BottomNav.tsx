import { useUIStore, type TabId } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home',    icon: '🏠', label: 'Главная'   },
  { id: 'charts',  icon: '📊', label: 'Чарты'     },
  { id: 'artists', icon: '🎤', label: 'Артисты'   },
  { id: 'library', icon: '📚', label: 'Библиотека'},
  { id: 'profile', icon: '👤', label: 'Профиль'   },
];

export function BottomNav() {
  const { activeTab, setTab } = useUIStore();
  const { track } = usePlayerStore();

  // Если играет трек — поднимаем навигацию выше мини-плеера
  const bottom = track ? 'bottom-[76px]' : 'bottom-0';

  return (
    <nav
      className={`fixed ${bottom} left-0 right-0 z-50 flex items-start pt-3
                  bg-bg/95 backdrop-blur-2xl border-t border-white/[0.06]`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className="flex-1 flex flex-col items-center gap-1 cursor-pointer
                       transition-transform duration-150 active:scale-90 border-none bg-transparent"
            onClick={() => setTab(tab.id)}
          >
            <span
              className="text-[22px] leading-none"
              style={{
                filter: isActive
                  ? 'drop-shadow(0 0 6px rgba(124,58,255,0.8))'
                  : undefined,
              }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[9px] font-display font-semibold uppercase tracking-wide"
              style={{ color: isActive ? '#7C3AFF' : 'rgba(240,238,249,0.35)' }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
