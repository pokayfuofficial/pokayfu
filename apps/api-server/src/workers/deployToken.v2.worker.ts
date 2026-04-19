// ─────────────────────────────────────────────────────────
//  POKAYFU — DeployToken Worker v2
//  Полный пайплайн деплоя токена с STON.FI интеграцией
// ─────────────────────────────────────────────────────────

import { Worker, Queue } from 'bullmq';
import { redis } from '../cache/redis';
import { db } from '../db/client';

import { createLiquidityPool, lockLiquidity } from '../blockchain/stonfi.service';

// ── QUEUE ─────────────────────────────────────────────

export const deployTokenQueue = new Queue<DeployTokenJob>('deploy-token', {
  connection: redis,
  defaultJobOptions: {
    attempts:          3,
    backoff:           { type: 'exponential', delay: 15000 },
    removeOnComplete:  { count: 200 },
    removeOnFail:      { count: 100 },
  },
});

// ── WORKER ────────────────────────────────────────────

export function startDeployTokenWorker() {
  const worker = new Worker<DeployTokenJob>(
    'deploy-token',
    async (job) => {
      const { trackId, artistId, ticker, artistTonWallet } = job.data;

      console.log(`\n[Worker] 🚀 Starting token deployment`);
      console.log(`  Track:  ${trackId}`);
      console.log(`  Ticker: ${ticker}`);

      // ── ШАГ 1: Статус DEPLOYING ────────────────────
      await db.track.update({
        where: { id: trackId },
        data:  { status: 'DEPLOYING' },
      });
      await job.updateProgress(5);

      try {
        const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || 'EQplatform_mock';
        const lockContract   = process.env.LIQUIDITY_LOCK_ADDRESS  || 'EQlock_mock';

        // ── ШАГ 2: Деплой Jetton контракта ────────────
        console.log(`[Worker] Step 2: Deploying Jetton contract...`);
        const contractAddress = await deployJettonContract({
          trackId,
          artistId,
          ticker,
          artistWallet:   artistTonWallet || artistWallet,
          platformWallet,
        });
        await job.updateProgress(30);
        console.log(`[Worker] Contract deployed: ${contractAddress}`);

        // ── ШАГ 3: Запись в БД ─────────────────────────
        const trackToken = await db.trackToken.create({
          data: {
            trackId,
            contractAddress,
            ticker,
            totalSupply:    '1000000000',
            currentPriceTon:'0.000001',
            lpLocked:       false,
          },
        });
        await job.updateProgress(40);

        // ── ШАГ 4: Создание пула ликвидности ──────────
        console.log(`[Worker] Step 4: Creating STON.FI liquidity pool...`);
        const pool = await createLiquidityPool({
          trackTokenAddress: contractAddress,
          initialTonAmount:  2,       // 2 TON начальная ликвидность
          initialTokens:     '150000000', // 15% от supply
          trackId,
          ticker,
        });
        await job.updateProgress(65);
        console.log(`[Worker] Pool created: ${pool.poolAddress}`);
        console.log(`[Worker] LP Token: ${pool.lpTokenAddress}`);

        // ── ШАГ 5: Блокировка LP навсегда ─────────────
        console.log(`[Worker] Step 5: Locking LP forever...`);
        const lockTxHash = await lockLiquidity({
          lpTokenAddress:    pool.lpTokenAddress,
          lpAmount:          '150000000',
          trackTokenAddress: contractAddress,
          lockContractAddress: lockContract,
          trackId,
          ticker,
        });
        await job.updateProgress(85);
        console.log(`[Worker] LP locked! TX: ${lockTxHash}`);

        // ── ШАГ 6: Обновляем БД ───────────────────────
        await db.trackToken.update({
          where: { id: trackToken.id },
          data: {
            lpLocked:    true,
            lpLockedAt:  new Date(),
            lpTxHash:    lockTxHash,
            deployTxHash: pool.txHash,
          },
        });

        await db.track.update({
          where: { id: trackId },
          data:  { status: 'ACTIVE' },
        });

        await job.updateProgress(95);

        // ── ШАГ 7: Уведомление артиста ────────────────
        await notifyArtist(artistId, ticker, contractAddress, lockTxHash);
        await job.updateProgress(100);

        console.log(`\n[Worker] ✅ Token ${ticker} deployed successfully!`);
        console.log(`  Contract: ${contractAddress}`);
        console.log(`  LP Locked: ${lockTxHash}`);

        return { contractAddress, ticker, lpTxHash: lockTxHash, success: true };

      } catch (err: any) {
        console.error(`[Worker] ❌ Deployment failed: ${err.message}`);

        // Откатываем статус
        await db.track.update({
          where: { id: trackId },
          data:  { status: 'FAILED' },
        });

        // Удаляем частично созданный token если есть
        await db.trackToken.deleteMany({ where: { trackId } });

        throw err;
      }
    },
    {
      connection:  redis,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
  });

  return worker;
}

// ── HELPERS ───────────────────────────────────────────

async function deployJettonContract(params: {
  trackId:       string;
  artistId:      string;
  ticker:        string;
  artistWallet:  string;
  platformWallet: string;
}): Promise<string> {
  if (process.env.NODE_ENV === 'development' || !process.env.TON_MNEMONIC) {
    // Dev: генерируем детерминированный mock адрес
    const hash = Buffer.from(params.trackId).toString('hex').padEnd(62, '0').slice(0, 62);
    await sleep(200); // Симуляция задержки блокчейна
    return `EQ${hash}`;
  }

  // Production: реальный деплой через TON SDK
  // const { TonClient, WalletContractV4 } = await import('@ton/ton');
  // const { mnemonicToPrivateKey } = await import('@ton/crypto');
  // ...
  throw new Error('Production deployment requires TON_MNEMONIC');
}

async function notifyArtist(
  artistId:        string,
  ticker:          string,
  contractAddress: string,
  lpTxHash:        string
) {
  try {
    const artist = await db.artist.findUnique({
      where:   { id: artistId },
      include: { user: true },
    });

    if (!artist?.user) return;

    const tgId = artist.user.telegramId;

    // TODO: Отправить через Telegraf.js
    // await bot.telegram.sendMessage(tgId, `
    // 🎉 Твой токен ${ticker} успешно запущен!
    // ...
    // `);

    console.log(`[Notify] Artist ${artist.user.name} (${tgId}): Token ${ticker} deployed`);
    console.log(`  Contract: ${contractAddress}`);
    console.log(`  LP Locked: ${lpTxHash}`);
  } catch (err: any) {
    console.error('[Notify] Failed:', err.message);
  }
}

export function generateTicker(title: string): string {
  const TRANSLIT: Record<string, string> = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ж':'ZH','З':'Z',
    'И':'I','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R',
    'С':'S','Т':'T','У':'U','Ф':'F','Х':'KH','Ц':'TS','Ч':'CH','Ш':'SH',
    'Щ':'SCH','Э':'E','Ю':'YU','Я':'YA','Ё':'YO',
  };

  const ticker = title
    .replace(/[^a-zA-ZА-Яа-яёЁ0-9\s]/g, '')
    .split(/\s+/)
    .map(word => {
      const first = word[0]?.toUpperCase() ?? '';
      return TRANSLIT[first] || (first.match(/[A-Z]/) ? first : '');
    })
    .join('')
    .slice(0, 6)
    .toUpperCase();

  return `$${ticker || 'TRK'}`;
}

// Фиктивный artistWallet для dev
const artistWallet = 'EQartist_mock_wallet_address_000000000000000000000000';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
