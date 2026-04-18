import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

// ── HELPERS ───────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  try { return JSON.parse(val) as T; }
  catch { return null; }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300
): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

// ── CACHE KEYS ─────────────────────────────────

export const CacheKeys = {
  chart:          (type: string, region: string, period: string) => `chart:${type}:${region}:${period}`,
  trackAnalytics: (trackId: string) => `analytics:track:${trackId}`,
  tokenPrice:     (contractAddr: string) => `token:price:${contractAddr}`,
  tonRubRate:     () => 'ton:rub:rate',
  forYou:         (userId: string) => `recommendations:${userId}`,
  artistProfile:  (artistId: string) => `artist:${artistId}`,
  trackDetail:    (trackId: string) => `track:${trackId}`,
  portfolio:      (userId: string) => `portfolio:${userId}`,
} as const;
