import { Worker, Queue, QueueEvents } from 'bullmq';
import { redis } from '../cache/redis';
import { db } from '../db/client';
import { DeployTokenJob } from '@pokayfu/shared-types';

// ── QUEUE ─────────────────────────────────────

export const deployTokenQueue = new Queue<DeployTokenJob>('deploy-token', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  },
});

// ── WORKER ────────────────────────────────────

export function startDeployTokenWorker() {
  const worker = new Worker<DeployTokenJob>(
    'deploy-token',
    async (job) => {
      const { trackId, artistId, ticker, artistTonWallet } = job.data;

      console.log(`[Worker] Deploying token for track ${trackId}, ticker ${ticker}`);

      // Шаг 1: Обновляем статус
      await db.track.update({
        where: { id: trackId },
        data: { status: 'DEPLOYING' },
      });

      await job.updateProgress(10);

      try {
        // Шаг 2: Деплой Jetton контракта на TON
        // TODO: Реальный деплой через TON SDK
        // const contractAddress = await deployJettonContract(ticker, artistTonWallet);
        const contractAddress = `EQ${generateMockAddress()}`; // заглушка для dev

        await job.updateProgress(40);

        // Шаг 3: Запись контракта в БД
        const trackToken = await db.trackToken.create({
          data: {
            trackId,
            contractAddress,
            ticker,
            totalSupply: '1000000000',
            currentPriceTon: '0.000001',
            lpLocked: false,
          },
        });

        await job.updateProgress(60);

        // Шаг 4: Создание пула ликвидности на STON.FI
        // TODO: Реальная интеграция с STON.FI SDK
        // await createLiquidityPool(contractAddress, INITIAL_LP_TON);
        console.log(`[Worker] Creating LP pool for ${contractAddress}...`);

        await job.updateProgress(80);

        // Шаг 5: Блокировка LP токенов навсегда
        // TODO: Отправить LP токены на LiquidityLock контракт
        // await lockLiquidity(lpTokenAddress, LOCK_CONTRACT_ADDRESS);
        const mockLpTxHash = `mock_lp_tx_${Date.now()}`;

        await db.trackToken.update({
          where: { id: trackToken.id },
          data: {
            lpLocked:   true,
            lpLockedAt: new Date(),
            lpTxHash:   mockLpTxHash,
          },
        });

        await job.updateProgress(95);

        // Шаг 6: Активируем трек
        await db.track.update({
          where: { id: trackId },
          data: { status: 'ACTIVE' },
        });

        // Шаг 7: Уведомление артисту в Telegram
        await notifyArtist(artistId, ticker, contractAddress);

        await job.updateProgress(100);

        console.log(`[Worker] Token ${ticker} deployed successfully at ${contractAddress}`);

        return { contractAddress, ticker, success: true };

      } catch (error) {
        // Откатываем статус при ошибке
        await db.track.update({
          where: { id: trackId },
          data: { status: 'FAILED' },
        });

        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 2, // не более 2 деплоев одновременно
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
  });

  return worker;
}

// ── HELPERS ────────────────────────────────────

function generateMockAddress(): string {
  return Array.from({ length: 62 }, () =>
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[
      Math.floor(Math.random() * 62)
    ]
  ).join('');
}

async function notifyArtist(artistId: string, ticker: string, contractAddress: string) {
  try {
    const artist = await db.artist.findUnique({
      where: { id: artistId },
      include: { user: true },
    });

    if (!artist) return;

    // TODO: Отправить уведомление через Telegraf
    console.log(`[Notify] Artist ${artist.user.name}: Token ${ticker} deployed at ${contractAddress}`);

  } catch (err) {
    console.error('[Notify] Failed to notify artist:', err);
  }
}

// ── GENERATE TICKER ────────────────────────────

export function generateTicker(title: string): string {
  // "Ночной Дрифт" → "$NDRIFT"
  const cleaned = title
    .replace(/[^a-zA-ZА-Яа-яёЁ0-9\s]/g, '')
    .split(/\s+/)
    .map(word => {
      // Транслитерация первых букв
      const translit: Record<string, string> = {
        'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ж':'ZH','З':'Z',
        'И':'I','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R',
        'С':'S','Т':'T','У':'U','Ф':'F','Х':'KH','Ц':'TS','Ч':'CH','Ш':'SH',
        'Щ':'SCH','Э':'E','Ю':'YU','Я':'YA','Ё':'YO',
      };
      const first = word[0]?.toUpperCase() ?? '';
      return translit[first] || first;
    })
    .join('')
    .slice(0, 6)
    .toUpperCase();

  return `$${cleaned || 'TRK'}`;
}
