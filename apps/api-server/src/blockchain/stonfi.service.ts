// ─────────────────────────────────────────────────────────
//  POKAYFU — STON.FI Integration Service
//  Создание пулов ликвидности и блокировка LP
// ─────────────────────────────────────────────────────────

import axios from 'axios';
import { db } from '../db/client';
import { redis } from '../cache/redis';
import {
  fetchTokenPriceFromStonfi,
  fetchStonfiPoolData,
  fetchTonRubRate,
} from './ton.client';

const STONFI_API = 'https://api.ston.fi/v1';
const PRICE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут

// ── ТИПЫ ──────────────────────────────────────────────

interface PoolCreationResult {
  poolAddress:   string;
  lpTokenAddress: string;
  txHash:         string;
}

interface PriceSyncResult {
  contractAddress: string;
  priceTon:        string;
  priceChange24h:  number;
  volume24h:       string;
  holderCount:     number;
}

// ── СОЗДАНИЕ ПУЛА ЛИКВИДНОСТИ ─────────────────────────

/**
 * Создаёт пул TON/TrackToken на STON.FI
 * Вызывается после успешного деплоя TrackToken
 */
export async function createLiquidityPool(params: {
  trackTokenAddress: string;
  initialTonAmount:  number;   // TON для начальной ликвидности
  initialTokens:     string;   // Количество токенов в пул
  trackId:           string;
  ticker:            string;
}): Promise<PoolCreationResult> {
  console.log(`[STON.FI] Creating liquidity pool for ${params.ticker}...`);
  console.log(`  Token: ${params.trackTokenAddress}`);
  console.log(`  Initial TON: ${params.initialTonAmount}`);
  console.log(`  Initial Tokens: ${params.initialTokens}`);

  try {
    // РЕАЛЬНАЯ ИНТЕГРАЦИЯ:
    // 1. Получаем router address STON.FI
    // 2. Отправляем транзакцию provide_liquidity
    // 3. Получаем адрес пула и LP токена

    // Для dev режима — mock
    if (process.env.NODE_ENV === 'development' || !process.env.TON_MNEMONIC) {
      const mockPool = `EQpool_${params.trackId.slice(0, 10)}`;
      const mockLp   = `EQlp_${params.trackId.slice(0, 10)}`;
      const mockTx   = `tx_${Date.now()}`;

      console.log(`  [MOCK] Pool: ${mockPool}`);
      console.log(`  [MOCK] LP Token: ${mockLp}`);

      return {
        poolAddress:    mockPool,
        lpTokenAddress: mockLp,
        txHash:         mockTx,
      };
    }

    // Production: реальный вызов STON.FI SDK
    // const router = await Router.create(STONFI_ROUTER_ADDRESS);
    // const txParams = await router.getProvideLiquidityTonTxParams({...});
    // const result = await wallet.sendTransaction(txParams);

    throw new Error('Production STON.FI deployment not yet configured');

  } catch (err: any) {
    console.error('[STON.FI] Pool creation failed:', err.message);
    throw err;
  }
}

/**
 * Блокирует LP токены через LiquidityLock контракт
 */
export async function lockLiquidity(params: {
  lpTokenAddress:    string;
  lpAmount:          string;
  trackTokenAddress: string;
  lockContractAddress: string;
  trackId:           string;
  ticker:            string;
}): Promise<string> {
  console.log(`[STON.FI] Locking LP tokens for ${params.ticker}...`);

  if (process.env.NODE_ENV === 'development' || !process.env.TON_MNEMONIC) {
    const mockTx = `lock_tx_${Date.now()}`;
    console.log(`  [MOCK] LP locked: ${mockTx}`);
    return mockTx;
  }

  // Production: отправка LP токенов на LiquidityLock контракт
  // const lockMsg = beginCell()
  //   .storeUint(0x1, 32) // lock_lp op
  //   .storeAddress(Address.parse(params.trackTokenAddress))
  //   .storeAddress(Address.parse(params.lpTokenAddress))
  //   .endCell();

  throw new Error('Production LP lock not yet configured');
}

// ── СИНХРОНИЗАЦИЯ ЦЕН ────────────────────────────────

/**
 * Синхронизирует цены всех активных токенов с STON.FI
 * Запускается кроном каждые 5 минут
 */
export async function syncAllTokenPrices(): Promise<void> {
  const startTime = Date.now();
  console.log('[PriceSync] Starting price synchronization...');

  try {
    // Получаем все активные Track Token контракты
    const trackTokens = await db.trackToken.findMany({
      where: { track: { status: 'ACTIVE' } },
      select: {
        id:              true,
        contractAddress: true,
        currentPriceTon: true,
        priceChange24h:  true,
      },
    });

    const artistTokens = await db.artistToken.findMany({
      where: { artist: { tracks: { some: { status: 'ACTIVE' } } } },
      select: {
        id:              true,
        contractAddress: true,
        currentPriceTon: true,
      },
    });

    let synced = 0;
    let failed = 0;

    // Синхронизируем Track Tokens
    for (const token of trackTokens) {
      try {
        const priceData = await fetchTokenPrice(token.contractAddress);
        if (priceData) {
          const prevPrice = parseFloat(token.currentPriceTon);
          const newPrice  = parseFloat(priceData.priceTon);
          const change24h = prevPrice > 0
            ? ((newPrice - prevPrice) / prevPrice) * 100
            : 0;

          await db.trackToken.update({
            where: { id: token.id },
            data: {
              currentPriceTon: priceData.priceTon,
              priceChange24h:  isNaN(change24h) ? 0 : change24h,
              volume24h:       priceData.volume24h,
              holderCount:     priceData.holderCount,
              marketCapTon:    (
                parseFloat(priceData.priceTon) * 1_000_000_000
              ).toFixed(4),
            },
          });

          // Записываем в историю цен
          await db.priceHistory.create({
            data: {
              trackTokenId: token.id,
              priceTon:     priceData.priceTon,
              volumeTon:    priceData.volume24h,
            },
          });

          // Кэшируем цену
          await redis.set(
            `token:price:${token.contractAddress}`,
            JSON.stringify(priceData),
            'EX',
            300
          );

          synced++;
        }
      } catch {
        failed++;
      }

      // Небольшая задержка чтобы не спамить API
      await sleep(50);
    }

    // Синхронизируем Artist Tokens
    for (const token of artistTokens) {
      try {
        const priceData = await fetchTokenPrice(token.contractAddress);
        if (priceData) {
          const prevPrice = parseFloat(token.currentPriceTon);
          const newPrice  = parseFloat(priceData.priceTon);
          const change24h = prevPrice > 0 ? ((newPrice - prevPrice) / prevPrice) * 100 : 0;

          await db.artistToken.update({
            where: { id: token.id },
            data: {
              currentPriceTon: priceData.priceTon,
              priceChange24h:  isNaN(change24h) ? 0 : change24h,
              volume24h:       priceData.volume24h,
              holderCount:     priceData.holderCount,
              marketCapTon:    (parseFloat(priceData.priceTon) * 100_000_000).toFixed(4),
            },
          });
          synced++;
        }
      } catch {
        failed++;
      }
      await sleep(50);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[PriceSync] Done in ${elapsed}ms. Synced: ${synced}, Failed: ${failed}`);

  } catch (err: any) {
    console.error('[PriceSync] Fatal error:', err.message);
  }
}

/**
 * Получает цену токена — сначала из STON.FI, затем bonding curve
 */
async function fetchTokenPrice(contractAddress: string): Promise<PriceSyncResult | null> {
  // Пробуем STON.FI API
  const stonfiData = await fetchTokenPriceFromStonfi(contractAddress);
  if (stonfiData) {
    return {
      contractAddress,
      priceTon:       stonfiData.priceTon,
      priceChange24h: stonfiData.priceChange24h,
      volume24h:      stonfiData.volume24h,
      holderCount:    0, // Получаем отдельно
    };
  }

  // Fallback: вычисляем из bonding curve через TON контракт
  try {
    // В dev режиме генерируем синтетические данные
    if (process.env.NODE_ENV === 'development') {
      const basePrice = 0.000001;
      const variation = (Math.random() - 0.5) * 0.1; // ±10%
      const newPrice  = basePrice * (1 + variation);

      return {
        contractAddress,
        priceTon:       newPrice.toFixed(8),
        priceChange24h: variation * 100,
        volume24h:      (Math.random() * 100).toFixed(4),
        holderCount:    Math.floor(Math.random() * 1000),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── ROYALTY FLOW DISTRIBUTION ─────────────────────────

/**
 * Распределяет Royalty Flow от сделки с Track Token
 * Вызывается при каждой транзакции с токеном
 */
export async function distributeRoyaltyFlow(params: {
  trackTokenId:  string;
  amountTon:     string;
  txHash:        string;
}): Promise<void> {
  try {
    const trackToken = await db.trackToken.findUnique({
      where:   { id: params.trackTokenId },
      include: { track: { include: { artist: { include: { artistToken: true } } } } },
    });

    if (!trackToken?.track?.artist?.artistToken) return;

    const artistToken = trackToken.track.artist.artistToken;
    const royaltyAmount = parseFloat(params.amountTon) * 0.25 / 1.25; // 0.25% из 1.25% комиссии

    if (royaltyAmount < 0.000001) return; // Слишком маленькая сумма

    // Получаем держателей Artist Token
    const holders = await db.tokenHolder.findMany({
      where: { artistTokenId: artistToken.id, tokenType: 'ARTIST' },
      orderBy: { amount: 'desc' },
      take: 100, // Топ-100 держателей
    });

    if (holders.length === 0) return;

    const totalHeld = holders.reduce(
      (sum: bigint, h: any) => sum + BigInt(h.amount || '0'),
      BigInt(0)
    );
    if (totalHeld === BigInt(0)) return;

    // Распределяем пропорционально
    const royaltyOps = holders.map((h: any) => {
      const share = (BigInt(h.amount || '0') * BigInt(Math.floor(royaltyAmount * 1e9))) / totalHeld;
      const shareFloat = Number(share) / 1e9;

      return db.royaltyPayout.create({
        data: {
          userId:       h.userId,
          trackTokenId: params.trackTokenId,
          amountTon:    shareFloat.toFixed(9),
          status:       'PENDING',
        },
      });
    });

    await Promise.all(royaltyOps);

    // Обновляем статистику royalty flow за 7 дней
    await db.artistToken.update({
      where: { id: artistToken.id },
      data:  {
        royaltyFlow7d: (parseFloat(artistToken.royaltyFlow7d) + royaltyAmount).toFixed(9),
      },
    });

    console.log(`[Royalty] Distributed ${royaltyAmount.toFixed(6)} TON to ${holders.length} holders of ${artistToken.ticker}`);

  } catch (err: any) {
    console.error('[Royalty] Distribution failed:', err.message);
  }
}

// ── АНАЛИТИКА ЧАРТОВ ──────────────────────────────────

/**
 * Вычисляет hot_score для всех активных треков
 * Используется для обновления чартов
 */
export async function computeAndSaveHotScores(): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const tracks = await db.track.findMany({
    where: { status: 'ACTIVE', trackToken: { isNot: null } },
    include: {
      trackToken: true,
      _count: { select: { plays: { where: { createdAt: { gte: since24h } } } } },
    },
  });

  if (tracks.length === 0) return;

  // Нормализация значений
  const plays24h    = tracks.map((t: any) => t._count.plays);
  const tokenGrowth = tracks.map((t: any) => Math.max(0, t.trackToken?.priceChange24h || 0));
  const holders     = tracks.map((t: any) => t.trackToken?.holderCount || 0);

  const normPlays   = normalize(plays24h);
  const normGrowth  = normalize(tokenGrowth);
  const normHolders = normalize(holders);

  // Вычисляем scores и сохраняем снапшоты
  const snapshots = tracks.map((track: any, i: number) => {
    const score = normPlays[i] * 0.5 + normGrowth[i] * 0.3 + normHolders[i] * 0.2;
    return { track, score };
  });

  snapshots.sort((a: any, b: any) => b.score - a.score);

  // Сохраняем в chart_snapshots
  await db.$transaction(
    snapshots.map(({ track, score }: any, rank: number) =>
      db.chartSnapshot.create({
        data: {
          trackId:   track.id,
          chartType: 'HOT',
          region:    'RU',
          score,
          rank:      rank + 1,
          metadata:  {
            plays24h:    track._count.plays,
            tokenChange: track.trackToken?.priceChange24h || 0,
            holderCount: track.trackToken?.holderCount || 0,
            volume24h:   track.trackToken?.volume24h || '0',
          },
        },
      })
    )
  );

  console.log(`[Charts] Hot scores computed for ${tracks.length} tracks`);
}

// ── HELPERS ───────────────────────────────────────────

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map(v => (v - min) / (max - min));
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
