import { db } from '../db/client';
import { cacheGetOrSet, cacheSet, CacheKeys } from '../cache/redis';


// ── HOT SCORE ALGORITHM ────────────────────────
//
// hot_score = normalize(plays_24h)   × 0.50
//           + normalize(token_growth) × 0.30
//           + normalize(new_holders)  × 0.20

interface RawTrackScore {
  trackId:     string;
  plays24h:    number;
  tokenGrowth: number;
  newHolders:  number;
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
}

export async function computeHotScores(): Promise<{ trackId: string; score: number; rank: number }[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Берём активные треки с токенами
  const tracks = await db.track.findMany({
    where: { status: 'ACTIVE', trackToken: { isNot: null } },
    include: {
      trackToken: true,
      plays: { where: { createdAt: { gte: since24h } } },
    },
  });

  if (tracks.length === 0) return [];

  const raw: RawTrackScore[] = tracks.map((t: any) => ({
    trackId:     t.id,
    plays24h:    t.plays.length,
    tokenGrowth: t.trackToken?.priceChange24h ?? 0,
    newHolders:  0, // TODO: подключить реальные данные держателей за 24ч
  }));

  const playNorm    = normalize(raw.map(r => r.plays24h));
  const tokenNorm   = normalize(raw.map(r => Math.max(0, r.tokenGrowth)));
  const holderNorm  = normalize(raw.map(r => r.newHolders));

  const scored = raw.map((r: any, i: number) => ({
    trackId: r.trackId,
    score:   playNorm[i] * 0.5 + tokenNorm[i] * 0.3 + holderNorm[i] * 0.2,
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s: any, i: number) => ({ ...s, rank: i + 1 }));
}

// ── GET CHART ──────────────────────────────────

export async function getChart(
  type: ChartType,
  region: Region = Region.RU,
  period: Period = Period.DAY,
  genre?: string,
  userId?: string
) {
  const cacheKey = CacheKeys.chart(type, region, period + (genre ? `:${genre}` : ''));
  const TTL = 15 * 60; // 15 минут

  return cacheGetOrSet(cacheKey, () => fetchChart(type, region, period, genre, userId), TTL);
}

async function fetchChart(
  type: ChartType,
  region: Region,
  period: Period,
  genre?: string,
  userId?: string
) {
  const periodMs: Record<Period, number> = {
    [Period.DAY]:   24 * 60 * 60 * 1000,
    [Period.WEEK]:  7  * 24 * 60 * 60 * 1000,
    [Period.MONTH]: 30 * 24 * 60 * 60 * 1000,
    [Period.ALL]:   365 * 24 * 60 * 60 * 1000,
  };
  const since = new Date(Date.now() - periodMs[period]);

  const baseWhere: any = {
    status: 'ACTIVE',
    trackToken: { isNot: null },
    ...(genre ? { genre: genre as any } : {}),
  };

  switch (type) {

    case ChartType.HOT: {
      const scores = await computeHotScores();
      return buildChartResponse(scores.slice(0, 50), type, region, period);
    }

    case ChartType.RISING: {
      const tracks = await db.track.findMany({
        where: baseWhere,
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { trackToken: { priceChange24h: 'desc' } },
        take: 50,
      });
      return formatTracks(tracks, type, region, period);
    }

    case ChartType.HOLDERS: {
      const tracks = await db.track.findMany({
        where: baseWhere,
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { trackToken: { holderCount: 'desc' } },
        take: 50,
      });
      return formatTracks(tracks, type, region, period);
    }

    case ChartType.NEW: {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tracks = await db.track.findMany({
        where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } },
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { totalPlays: 'desc' },
        take: 50,
      });
      return formatTracks(tracks, type, region, period);
    }

    case ChartType.VOLUME: {
      const tracks = await db.track.findMany({
        where: baseWhere,
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { trackToken: { volume24h: 'desc' } },
        take: 50,
      });
      return formatTracks(tracks, type, region, period);
    }

    case ChartType.GENRE: {
      const tracks = await db.track.findMany({
        where: baseWhere,
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { totalPlays: 'desc' },
        take: 20,
      });
      return formatTracks(tracks, type, region, period);
    }

    case ChartType.FOR_YOU: {
      // Персональные рекомендации — TODO: ML модель
      // Пока возвращаем горячие из предпочитаемых жанров
      const tracks = await db.track.findMany({
        where: baseWhere,
        include: { trackToken: true, artist: { include: { user: true } } },
        orderBy: { totalPlays: 'desc' },
        take: 20,
      });
      return formatTracks(tracks, type, region, period);
    }

    default:
      return formatTracks([], type, region, period);
  }
}

function buildChartResponse(
  scores: { trackId: string; score: number; rank: number }[],
  type: ChartType,
  region: Region,
  period: Period
) {
  return {
    type,
    region,
    period,
    updatedAt: new Date().toISOString(),
    entries: scores.map(s => ({
      rank:    s.rank,
      trackId: s.trackId,
      score:   s.score,
    })),
  };
}

function formatTracks(tracks: any[], type: ChartType, region: Region, period: Period) {
  return {
    type,
    region,
    period,
    updatedAt: new Date().toISOString(),
    entries: tracks.map((track, i) => ({
      rank:        i + 1,
      prevRank:    null,
      track: {
        id:          track.id,
        title:       track.title,
        genre:       track.genre,
        coverUrl:    track.coverUrl,
        durationSec: track.durationSec,
        artist:      { id: track.artistId, user: track.artist?.user },
        totalPlays:  track.totalPlays,
        likeCount:   track.likeCount,
        trackToken:  track.trackToken ? {
          contractAddress: track.trackToken.contractAddress,
          ticker:          track.trackToken.ticker,
          currentPriceTon: track.trackToken.currentPriceTon,
          priceChange24h:  track.trackToken.priceChange24h,
          holderCount:     track.trackToken.holderCount,
          lpLocked:        track.trackToken.lpLocked,
        } : null,
      },
      hotScore:    0,
      plays24h:    track.totalPlays,
      tokenChange: track.trackToken?.priceChange24h ?? 0,
      holderCount: track.trackToken?.holderCount ?? 0,
      volume24h:   track.trackToken?.volume24h ?? '0',
    })),
  };
}

// ── CRON: обновление чартов каждые 15 минут ────

export async function refreshAllCharts() {
  console.log('[Charts] Refreshing all charts...');

  const regions = [Region.RU, Region.CIS, Region.WORLD];
  const periods = [Period.DAY, Period.WEEK, Period.MONTH];
  const types   = [ChartType.HOT, ChartType.RISING, ChartType.HOLDERS, ChartType.NEW, ChartType.VOLUME];

  for (const type of types) {
    for (const region of regions) {
      for (const period of periods) {
        try {
          const chart = await fetchChart(type, region, period);
          await cacheSet(CacheKeys.chart(type, region, period), chart, 15 * 60);
        } catch (err) {
          console.error(`[Charts] Error refreshing ${type}/${region}/${period}:`, err);
        }
      }
    }
  }

  console.log('[Charts] All charts refreshed');
}
