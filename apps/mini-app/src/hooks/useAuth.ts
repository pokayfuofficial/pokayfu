import { useEffect } from 'react';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

/**
 * Хук авторизации через Telegram Mini App
 * Автоматически авторизует пользователя при запуске
 */
export function useAuth() {
  const { user, isAuth, isLoading, setUser, setTokens, setLoading } = useAuthStore();

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // Получаем initData от Telegram
        const tg = (window as any).Telegram?.WebApp;
        const initData = tg?.initData || '';

        // В dev режиме работаем без реального Telegram
        const res = await authApi.loginTelegram(initData || 'dev_mode');
        const { accessToken, refreshToken, user } = res.data.data;

        setTokens(accessToken, refreshToken);
        setUser(user);

        // Сообщаем Telegram что приложение готово
        tg?.ready?.();
        tg?.expand?.();
        // Убираем кнопку назад по умолчанию
        tg?.BackButton?.hide?.();

      } catch (err) {
        console.error('[Auth] Failed to authenticate:', err);
        // В dev режиме создаём mock пользователя
        if (import.meta.env.DEV) {
          setUser({
            id:           'dev-user-1',
            telegramId:   '123456789',
            name:         'Dev User',
            username:     'devuser',
            avatarUrl:    null,
            role:         'LISTENER' as any,
            referralCode: 'DEV-0001',
            referredBy:   null,
            isPremium:    false,
            premiumUntil: null,
            createdAt:    new Date().toISOString(),
          });
          setTokens('dev-token', 'dev-refresh');
        }
      } finally {
        setLoading(false);
      }
    }

    if (!isAuth) {
      init();
    } else {
      setLoading(false);
    }
  }, []);

  return { user, isAuth, isLoading };
}
