import { create } from 'zustand';

export type TabId = 'home' | 'charts' | 'artists' | 'library' | 'profile';

export type ModalType =
  | { type: 'buy-token'; trackId: string }
  | { type: 'tip'; artistId: string }
  | { type: 'comment'; trackId: string }
  | { type: 'share'; trackId: string }
  | null;

interface NavEntry {
  screen: string;
  params?: Record<string, string>;
}

interface UIState {
  // Навигация
  activeTab:    TabId;
  navHistory:   NavEntry[];
  currentScreen: string;
  screenParams:  Record<string, string>;
  // Модалки
  modal:        ModalType;
  // Toast
  toast:        string | null;
  toastType:    'success' | 'error' | 'info';

  // Actions
  setTab:       (tab: TabId) => void;
  navigate:     (screen: string, params?: Record<string, string>) => void;
  goBack:       () => void;
  openModal:    (modal: ModalType) => void;
  closeModal:   () => void;
  showToast:    (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab:     'home',
  navHistory:    [{ screen: 'home' }],
  currentScreen: 'home',
  screenParams:  {},
  modal:         null,
  toast:         null,
  toastType:     'success',

  setTab: (tab) => {
    set({
      activeTab:     tab,
      currentScreen: tab,
      screenParams:  {},
      navHistory:    [{ screen: tab }],
    });
  },

  navigate: (screen, params = {}) => {
    const { navHistory } = get();
    set({
      currentScreen: screen,
      screenParams:  params,
      navHistory:    [...navHistory, { screen, params }],
    });
  },

  goBack: () => {
    const { navHistory } = get();
    if (navHistory.length <= 1) return;

    const newHistory = navHistory.slice(0, -1);
    const prev = newHistory[newHistory.length - 1];

    set({
      navHistory:    newHistory,
      currentScreen: prev.screen,
      screenParams:  prev.params || {},
    });
  },

  openModal:  (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  showToast: (msg, type = 'success') => {
    set({ toast: msg, toastType: type });
    setTimeout(() => set({ toast: null }), 3000);
  },
}));
