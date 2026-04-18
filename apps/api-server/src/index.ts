import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import cron from 'node-cron';

import { authRoutes }   from './routes/auth';
import { userRoutes }   from './routes/users';
import { artistRoutes } from './routes/artists';
import { trackRoutes }  from './routes/tracks';
import { tokenRoutes }  from './routes/tokens';
import { chartRoutes }  from './routes/charts';
import { redis }        from './cache/redis';
import { db }           from './db/client';
import { startDeployTokenWorker } from './workers/deployToken.worker';
import { refreshAllCharts }       from './services/charts.service';

// ── SERVER ─────────────────────────────────────

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// ── PLUGINS ────────────────────────────────────

async function registerPlugins() {
  // CORS
  await server.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  // JWT
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'pokayfu-dev-secret-change-in-prod',
  });

  // Rate limiting
  await server.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => {
      const payload = (req as any).user;
      return payload?.userId || req.ip;
    },
  });
}

// ── ROUTES ─────────────────────────────────────

async function registerRoutes() {
  const prefix = '/v1';

  server.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  await server.register(authRoutes,   { prefix: `${prefix}/auth` });
  await server.register(userRoutes,   { prefix: `${prefix}/users` });
  await server.register(artistRoutes, { prefix: `${prefix}/artists` });
  await server.register(trackRoutes,  { prefix: `${prefix}/tracks` });
  await server.register(tokenRoutes,  { prefix: `${prefix}/tokens` });
  await server.register(chartRoutes,  { prefix: `${prefix}/charts` });

  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error:   `Route ${request.method} ${request.url} not found`,
      code:    'NOT_FOUND',
      status:  404,
    });
  });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error(error);

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error:   'Слишком много запросов. Попробуйте позже.',
        code:    'RATE_LIMIT_EXCEEDED',
        status:  429,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error:   'Ошибка валидации данных',
        code:    'VALIDATION_ERROR',
        status:  400,
        details: error.validation,
      });
    }

    return reply.status(500).send({
      success: false,
      error:   process.env.NODE_ENV === 'production' ? 'Внутренняя ошибка сервера' : error.message,
      code:    'INTERNAL_ERROR',
      status:  500,
    });
  });
}

// ── CRON JOBS ──────────────────────────────────

function startCronJobs() {
  // Обновление чартов каждые 15 минут
  cron.schedule('*/15 * * * *', async () => {
    try {
      await refreshAllCharts();
    } catch (err) {
      server.log.error({ err }, '[Cron] Chart refresh failed');
    }
  });

  // Обновление цен токенов каждые 5 минут
  cron.schedule('*/5 * * * *', async () => {
    try {
      await syncTokenPrices();
    } catch (err) {
      server.log.error({ err }, '[Cron] Token price sync failed:');
    }
  });

  // Обновление курса TON/RUB каждые 10 минут
  cron.schedule('*/10 * * * *', async () => {
    try {
      await syncTonRubRate();
    } catch (err) {
      server.log.error({ err }, '[Cron] TON/RUB rate sync failed:');
    }
  });

  // Обновление статистики треков каждый час
  cron.schedule('0 * * * *', async () => {
    try {
      await updateTrackStats();
    } catch (err) {
      server.log.error({ err }, '[Cron] Track stats update failed:');
    }
  });

  server.log.info('[Cron] All cron jobs started');
}

// ── BACKGROUND TASKS ───────────────────────────

async function syncTokenPrices() {
  // TODO: Получить реальные цены с STON.FI / TON блокчейна
  // Пока просто логируем
  server.log.debug('[Sync] Token prices synced');
}

async function syncTonRubRate() {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=rub',
      { timeout: 5000 }
    );
    const rate = res.data?.['the-open-network']?.rub;
    if (rate) {
      await redis.set('ton:rub:rate', String(rate), 'EX', 900); // 15 мин
      server.log.debug(`[Sync] TON/RUB rate: ${rate}`);
    }
  } catch {
    server.log.warn('[Sync] Failed to fetch TON/RUB rate, using cached value');
  }
}

async function updateTrackStats() {
  // Пересчёт кэшированных метрик для всех активных треков
  const tracks = await db.track.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
  });

  for (const track of tracks) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [plays, uniqueListeners] = await Promise.all([
      db.play.count({ where: { trackId: track.id, createdAt: { gte: since30d } } }),
      db.play.groupBy({ by: ['userId'], where: { trackId: track.id, createdAt: { gte: since30d } } }).then((r: Array<{userId: string}>) => r.length),
    ]);

    await db.track.update({
      where: { id: track.id },
      data:  { uniqueListeners },
    });
  }

  server.log.debug(`[Sync] Updated stats for ${tracks.length} tracks`);
}

// ── STARTUP ────────────────────────────────────

async function start() {
  try {
    // Регистрируем плагины и роуты
    await registerPlugins();
    await registerRoutes();

    // Подключаем Redis
    await redis.connect();

    // Запускаем BullMQ воркер деплоя токенов
    startDeployTokenWorker();
    server.log.info('[Workers] Deploy token worker started');

    // Запускаем cron задачи
    startCronJobs();

    // Инициализируем курс TON/RUB
    await syncTonRubRate();

    // Первое обновление чартов при старте
    refreshAllCharts().catch(err => server.log.error({ err }, '[Charts] Initial refresh failed:'));

    // Запуск сервера
    const PORT = parseInt(process.env.PORT || '3001');
    const HOST = process.env.HOST || '0.0.0.0';

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`
╔═══════════════════════════════════════╗
║        POKAYFU API SERVER             ║
║   Running at http://${HOST}:${PORT}   ║
║   Environment: ${process.env.NODE_ENV || 'development'}          ║
╚═══════════════════════════════════════╝
    `);

  } catch (err) {
    console.error("STARTUP ERROR:", err););
    process.exit(1);
  }
}

// ── GRACEFUL SHUTDOWN ──────────────────────────

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal: string) {
  server.log.info(`[Shutdown] Received ${signal}, shutting down gracefully...`);
  try {
    await server.close();
    await db.$disconnect();
    await redis.quit();
    server.log.info('[Shutdown] Server closed');
    process.exit(0);
  } catch (err) {
    server.log.error({ err }, '[Shutdown] Error during shutdown:');
    process.exit(1);
  }
}

// ── START ──────────────────────────────────────
start();
