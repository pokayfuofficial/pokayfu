// ─────────────────────────────────────────────────────────
//  POKAYFU — Cron Jobs Service
//  Все фоновые задачи платформы
// ─────────────────────────────────────────────────────────

import cron from 'node-cron';
import { db } from '../db/client';
import { redis } from '../cache/redis';
import { refreshAllCharts } from '../services/charts.service';
import {
  syncAllTokenPrices,
  computeAndSaveHotScores,
} from '../blockchain/stonfi.service';
import { fetchTonRubRate } from '../blockchain/ton.client';

// ── JOB REGISTRY ──────────────────────────────────────

interface CronJob {
  name:     string;
  schedule: string;
  fn:       () => Promise<void>;
  lastRun:  Date | null;
  lastErr:  string | null;
  runs:     number;
}

const jobs: CronJob[] = [];

// ── JOB RUNNER ────────────────────────────────────────

function registerJob(name: string, schedule: string, fn: () => Promise<void>) {
  const job: CronJob = { name, schedule, fn, lastRun: null, lastErr: null, runs: 0 };
  jobs.push(job);

  cron.schedule(schedule, async () => {
    const start = Date.now();
    try {
      await fn();
      job.lastRun = new Date();
      job.lastErr = null;
      job.runs++;
      console.log(`[Cron:${name}] ✅ Done in ${Date.now() - start}ms`);
    } catch (err: any) {
      job.lastErr = err.message;
      console.error(`[Cron:${name}] ❌ Error: ${err.message}`);
    }
  });

  console.log(`[Cron] Registered "${name}" @ ${schedule}`);
}

// ── JOBS ──────────────────────────────────────────────

export function startAllCronJobs() {

  // ── 1. TON/RUB курс — каждые 10 минут ───────────────
  registerJob('ton-rub-rate', '*/10 * * * *', async () => {
    const rate = await fetchTonRubRate();
    await redis.set('ton:rub:rate', String(rate), 'EX', 900);
    console.log(`[Cron:ton-rub-rate] TON/RUB = ${rate}`);
  });

  // ── 2. Синхронизация цен токенов — каждые 5 минут ───
  registerJob('token-prices', '*/5 * * * *', async () => {
    await syncAllTokenPrices();
  });

  // ── 3. Hot Score и чарты — каждые 15 минут ──────────
  registerJob('charts', '*/15 * * * *', async () => {
    await computeAndSaveHotScores();
    await refreshAllCharts();
  });

  // ── 4. Статистика треков — каждый час ────────────────
  registerJob('track-stats', '0 * * * *', async () => {
    await updateTrackAggregates();
  });

  // ── 5. Очистка старых снапшотов — раз в день ─────────
  registerJob('cleanup', '0 2 * * *', async () => {
    await cleanupOldSnapshots();
  });

  // ── 6. Royalty Flow 7d — каждые 6 часов ─────────────
  registerJob('royalty-7d', '0 */6 * * *', async () => {
    await resetWeeklyRoyaltyStats();
  });

  // ── 7. Healthcheck БД — каждую минуту ────────────────
  registerJob('db-health', '* * * * *', async () => {
    await db.$queryRaw`SELECT 1`;
  });

  console.log(`[Cron] All ${jobs.length} jobs registered`);
}

// ── JOB IMPLEMENTATIONS ───────────────────────────────

async function updateTrackAggregates() {
  const activeTracks = await db.track.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
  });

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let updated = 0;

  for (const track of activeTracks) {
    try {
      const [playCount, uniqueResult, completedCount, libCount] = await Promise.all([
        db.play.count({ where: { trackId: track.id } }),
        db.play.groupBy({
          by: ['userId'],
          where: { trackId: track.id, createdAt: { gte: since30d } },
        }).then((r: any[]) => r.length),
        db.play.count({ where: { trackId: track.id, completed: true } }),
        db.tokenHolder.count({ where: { trackToken: { trackId: track.id } } }),
      ]);

      const completionRate = playCount > 0
        ? (completedCount / playCount) * 100
        : 0;

      await db.track.update({
        where: { id: track.id },
        data: {
          totalPlays:      playCount,
          uniqueListeners: uniqueResult,
          completionRate:  Math.round(completionRate * 10) / 10,
          libraryCount:    libCount,
        },
      });
      updated++;
    } catch {
      // Продолжаем даже если один трек упал
    }
  }

  console.log(`[Cron:track-stats] Updated ${updated}/${activeTracks.length} tracks`);
}

async function cleanupOldSnapshots() {
  // Удаляем снапшоты старше 30 дней (кроме дневных)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await db.chartSnapshot.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });
  console.log(`[Cron:cleanup] Deleted ${count} old chart snapshots`);

  // Удаляем старые history цен (оставляем 90 дней)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count: priceCount } = await db.priceHistory.deleteMany({
    where: { timestamp: { lt: ninetyDaysAgo } },
  });
  console.log(`[Cron:cleanup] Deleted ${priceCount} old price history records`);
}

async function resetWeeklyRoyaltyStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Пересчитываем royaltyFlow7d для всех Artist Tokens
  const artistTokens = await db.artistToken.findMany({
    select: { id: true },
  });

  for (const at of artistTokens) {
    const weeklyPayouts = await db.royaltyPayout.aggregate({
      where: {
        trackToken: { track: { artist: { artistToken: { id: at.id } } } },
        createdAt:  { gte: sevenDaysAgo },
      },
      _sum: { amountTon: true },
    });

    await db.artistToken.update({
      where: { id: at.id },
      data:  { royaltyFlow7d: weeklyPayouts._sum?.amountTon || '0' },
    });
  }

  console.log(`[Cron:royalty-7d] Updated royalty stats for ${artistTokens.length} artist tokens`);
}

// ── STATUS ENDPOINT ───────────────────────────────────

export function getCronStatus() {
  return jobs.map(j => ({
    name:     j.name,
    schedule: j.schedule,
    lastRun:  j.lastRun?.toISOString() || null,
    lastErr:  j.lastErr,
    runs:     j.runs,
  }));
}
