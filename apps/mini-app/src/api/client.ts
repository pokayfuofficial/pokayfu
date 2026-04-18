import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── REQUEST INTERCEPTOR: добавляем JWT ──────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── RESPONSE INTERCEPTOR: refresh при 401 ───────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken } = res.data.data;

        useAuthStore.getState().setTokens(accessToken, refreshToken);
        original.headers.Authorization = `Bearer ${accessToken}`;

        return api(original);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ── API METHODS ────────────────────────────────

export const authApi = {
  loginTelegram: (initData: string) =>
    api.post('/auth/telegram', { initData }),
  me: () =>
    api.get('/auth/me'),
};

export const tracksApi = {
  getById:      (id: string) => api.get(`/tracks/${id}`),
  getAnalytics: (id: string, period?: string) => api.get(`/tracks/${id}/analytics`, { params: { period } }),
  getStream:    (id: string) => api.get(`/tracks/${id}/stream`),
  getPreview:   (id: string) => api.get(`/tracks/${id}/preview`),
  recordPlay:   (id: string, data: { durationSec: number; completed: boolean }) =>
    api.post(`/tracks/${id}/play`, data),
  like:         (id: string) => api.post(`/tracks/${id}/like`),
  getComments:  (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/tracks/${id}/comments`, { params }),
  addComment:   (id: string, text: string) => api.post(`/tracks/${id}/comment`, { text }),
  search:       (q: string, genre?: string) => api.get('/tracks/search', { params: { q, genre } }),
  upload:       (formData: FormData) => api.post('/tracks/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  create:       (data: any) => api.post('/tracks', data),
};

export const artistsApi = {
  getTop:      (limit?: number) => api.get('/artists/top', { params: { limit } }),
  getById:     (id: string) => api.get(`/artists/${id}`),
  getTracks:   (id: string, params?: any) => api.get(`/artists/${id}/tracks`, { params }),
  getStats:    (id: string) => api.get(`/artists/${id}/stats`),
  follow:      (id: string) => api.post(`/artists/${id}/follow`),
  tip:         (id: string, data: { amountTon: string; txHash: string }) =>
    api.post(`/artists/${id}/tip`, data),
  register:    (data: any) => api.post('/artists/register', data),
  updateMe:    (data: any) => api.patch('/artists/me', data),
  search:      (q: string) => api.get('/artists/search', { params: { q } }),
};

export const tokensApi = {
  getTrackToken:    (id: string) => api.get(`/tokens/track/${id}`),
  getArtistToken:   (id: string) => api.get(`/tokens/artist/${id}`),
  buy:              (id: string, data: { amountTon: string; slippage?: number }) =>
    api.post(`/tokens/track/${id}/buy`, data),
  confirmBuy:       (id: string, data: { transactionId: string; txHash: string }) =>
    api.post(`/tokens/track/${id}/buy/confirm`, data),
  sell:             (id: string, data: { tokensAmount: string }) =>
    api.post(`/tokens/track/${id}/sell`, data),
  getHolders:       (id: string) => api.get(`/tokens/track/${id}/holders`),
  getPriceHistory:  (id: string, period?: string) =>
    api.get(`/tokens/track/${id}/price-history`, { params: { period } }),
  getTransactions:  (id: string, params?: any) =>
    api.get(`/tokens/track/${id}/transactions`, { params }),
  claimRoyalty:     () => api.post('/tokens/royalty/claim'),
};

export const chartsApi = {
  getHot:     (params?: any) => api.get('/charts/hot', { params }),
  getRising:  (params?: any) => api.get('/charts/rising', { params }),
  getHolders: (params?: any) => api.get('/charts/holders', { params }),
  getNew:     (params?: any) => api.get('/charts/new', { params }),
  getVolume:  (params?: any) => api.get('/charts/volume', { params }),
  getGenre:   (genre: string, params?: any) => api.get(`/charts/genre/${genre}`, { params }),
  getForYou:  () => api.get('/charts/for-you'),
  getRegion:  (params?: any) => api.get('/charts/region', { params }),
};

export const usersApi = {
  getById:      (id: string) => api.get(`/users/${id}`),
  updateMe:     (data: any) => api.patch('/users/me', data),
  getLibrary:   () => api.get('/users/me/library'),
  getPortfolio: () => api.get('/users/me/portfolio'),
  getRoyalty:   (params?: any) => api.get('/users/me/royalty', { params }),
  getReferrals: () => api.get('/users/me/referrals'),
  applyReferral:(code: string) => api.post('/users/referral/apply', { code }),
};
