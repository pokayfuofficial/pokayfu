import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import { requireAuth, requireArtist } from '../middleware/auth';
import { deployTokenQueue, generateTicker } from '../workers/deployToken.worker';
import { cacheGetOrSet, cacheDel, CacheKeys } from '../cache/redis';
import { checkTrackAccess } from '../utils/bonding-curve';
import { Genre } from '@pokayfu/shared-types';

const CreateTrackSchema = z.object({
  title:   z.string().min(1).max(200),
  genre:   z.nativeEnum(Genre),
  year:    z.number().int().min(1900).max(2030),
  lyrics:  z.string().optional(),
  audioUrl:   z.string().url(),
  coverUrl:   z.string().url().optional(),
  durationSec: z.number().int().min(1),
});

const PlaySchema = z.object({
  durationSec: z.number().int().min(1),
  completed:   z.boolean(),
});

export async function trackRoutes(fastify: FastifyInstance) {

  // GET /tracks/search
  fastify.get('/tracks/search', async (request, reply) => {
    const { q, genre, limit = '20', offset = '0' } = request.query as any;

    if (!q || String(q).trim().length < 2) {
      return reply.status(400).send({ success: false, error: 'Минимум 2 символа', code: 'VALIDATION_ERROR', status: 400 });
    }

    const tracks = await db.track.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { artist: { user: { name: { contains: q, mode: 'insensitive' } } } },
        ],
        ...(genre ? { genre: genre as Genre } : {}),
      },
      include: {
        artist: { include: { user: true } },
        trackToken: true,
      },
      take: Math.min(parseInt(limit), 50),
      skip: parseInt(offset),
      orderBy: { totalPlays: 'desc' },
    });

    return reply.send({ success: true, data: tracks });
  });

  // GET /tracks/:id
  fastify.get('/tracks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const track = await cacheGetOrSet(
      CacheKeys.trackDetail(id),
      async () => db.track.findUnique({
        where: { id },
        include: {
          artist: { include: { user: true, artistToken: true } },
          trackToken: true,
          _count: { select: { likes: true, comments: true } },
        },
      }),
      60 // 1 минута кэш
    );

    if (!track) {
      return reply.status(404).send({ success: false, error: 'Трек не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: track });
  });

  // GET /tracks/:id/stream — требует наличие токенов
  fastify.get('/tracks/:id/stream', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };

    const track = await db.track.findUnique({
      where: { id, status: 'ACTIVE' },
      include: { trackToken: true },
    });

    if (!track || !track.trackToken) {
      return reply.status(404).send({ success: false, error: 'Трек не найден', code: 'NOT_FOUND', status: 404 });
    }

    // Проверяем доступ: достаточно ли токенов
    const holder = await db.tokenHolder.findFirst({
      where: { userId: payload.userId, trackTokenId: track.trackToken.id },
    });

    const tokensOwned = parseFloat(holder?.amount ?? '0');
    const currentPrice = parseFloat(track.trackToken.currentPriceTon);

    // Получаем курс TON/RUB из кэша
    const { redis: redisClient } = await import('../cache/redis');
    const tonRubRaw = await redisClient.get('ton:rub:rate');
    const tonRubRate = tonRubRaw ? parseFloat(tonRubRaw) : 150; // fallback 150 руб

    const hasAccess = checkTrackAccess(tokensOwned, currentPrice, tonRubRate);

    if (!hasAccess) {
      return reply.status(403).send({
        success: false,
        error:   'Недостаточно токенов. Купите токены трека (~15 руб) для полного доступа.',
        code:    'ACCESS_DENIED',
        status:  403,
        data: {
          currentTokens: tokensOwned,
          currentValue:  tokensOwned * currentPrice * tonRubRate,
          threshold:     15,
          tokenPrice:    currentPrice,
        },
      });
    }

    // Генерируем подписанный URL для CDN (TTL 1 час)
    // TODO: Реальная подпись URL для Cloudflare R2
    const streamUrl = `${track.audioUrl}?token=${Date.now()}&ttl=3600`;

    return reply.send({ success: true, data: { streamUrl, durationSec: track.durationSec } });
  });

  // GET /tracks/:id/preview — без авторизации, 45 сек
  fastify.get('/tracks/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };

    const track = await db.track.findUnique({
      where: { id, status: 'ACTIVE' },
      select: { audioUrl: true, durationSec: true },
    });

    if (!track) {
      return reply.status(404).send({ success: false, error: 'Трек не найден', code: 'NOT_FOUND', status: 404 });
    }

    // TODO: Реальная нарезка первых 45 секунд через FFmpeg
    return reply.send({
      success: true,
      data: {
        previewUrl: `${track.audioUrl}?preview=45s`,
        previewDuration: Math.min(45, track.durationSec),
      },
    });
  });

  // GET /tracks/:id/analytics
  fastify.get('/tracks/:id/analytics', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { period = '7d' } = request.query as { period?: string };

    const periodDays: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, 'all': 365 };
    const days = periodDays[period] ?? 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [track, plays] = await Promise.all([
      db.track.findUnique({
        where: { id },
        include: { trackToken: true },
      }),
      db.play.findMany({
        where: { trackId: id, createdAt: { gte: since } },
      }),
    ]);

    if (!track) {
      return reply.status(404).send({ success: false, error: 'Трек не найден', code: 'NOT_FOUND', status: 404 });
    }

    // Аналитика прослушиваний
    const completedPlays = plays.filter((p: any) => p.completed);
    const completionRate = plays.length > 0
      ? (completedPlays.length / plays.length) * 100
      : 0;

    // Уникальные слушатели
    const uniqueListeners = new Set(plays.map((p: any) => p.userId)).size;

    // По дням
    const playsByDay: Record<string, number> = {};
    plays.forEach((p: any) => {
      const day = p.createdAt.toISOString().split('T')[0];
      playsByDay[day] = (playsByDay[day] || 0) + 1;
    });

    // Geography
    const geoMap: Record<string, number> = {};
    plays.forEach((p: any) => {
      const country = p.country || 'Unknown';
      geoMap[country] = (geoMap[country] || 0) + 1;
    });

    const totalGeo = plays.length || 1;
    const geography = Object.entries(geoMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({
        country,
        flag: countryToFlag(country),
        percentage: Math.round((count / totalGeo) * 100),
      }));

    return reply.send({
      success: true,
      data: {
        trackId:         id,
        totalPlays:      track.totalPlays,
        plays24h:        plays.length,
        uniqueListeners,
        completionRate:  Math.round(completionRate * 10) / 10,
        avgListenSec:    plays.length > 0
          ? Math.round(plays.reduce((s: number, p: any) => s + p.durationSec, 0) / plays.length)
          : 0,
        playsByDay:      Object.entries(playsByDay).map(([date, count]) => ({ date, plays: count })),
        retentionCurve:  generateRetentionCurve(plays, track.durationSec),
        geography,
        likeCount:       track.likeCount,
        commentCount:    track.commentCount,
        shareCount:      track.shareCount,
        repostCount:     0,
        libraryCount:    track.libraryCount,
        newHolders24h:   track.trackToken?.holderCount ?? 0,
      },
    });
  });

  // POST /tracks/:id/play — запись прослушивания
  fastify.post('/tracks/:id/play', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };
    const body = PlaySchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Неверные данные', code: 'VALIDATION_ERROR', status: 400 });
    }

    const { durationSec, completed } = body.data;

    // Минимум 30 сек для записи прослушивания (защита от накрутки)
    if (durationSec < 30) {
      return reply.send({ success: true, data: { recorded: false, reason: 'Too short' } });
    }

    await Promise.all([
      db.play.create({
        data: {
          userId:      payload.userId,
          trackId:     id,
          durationSec,
          completed,
          country:     (request.headers['cf-ipcountry'] as string) || null,
          userAgent:   request.headers['user-agent'] || null,
        },
      }),
      // Инкремент счётчика
      db.track.update({
        where: { id },
        data: { totalPlays: { increment: 1 } },
      }),
    ]);

    // Инвалидируем кэш
    await cacheDel(CacheKeys.trackDetail(id));

    return reply.send({ success: true, data: { recorded: true } });
  });

  // POST /tracks/:id/like — toggle лайк
  fastify.post('/tracks/:id/like', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };

    const existing = await db.like.findUnique({
      where: { userId_trackId: { userId: payload.userId, trackId: id } },
    });

    if (existing) {
      await db.like.delete({ where: { userId_trackId: { userId: payload.userId, trackId: id } } });
      await db.track.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
      return reply.send({ success: true, data: { liked: false } });
    } else {
      await db.like.create({ data: { userId: payload.userId, trackId: id } });
      await db.track.update({ where: { id }, data: { likeCount: { increment: 1 } } });
      return reply.send({ success: true, data: { liked: true } });
    }
  });

  // GET /tracks/:id/comments
  fastify.get('/tracks/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '20', offset = '0' } = request.query as any;

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where: { trackId: id },
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      db.comment.count({ where: { trackId: id } }),
    ]);

    return reply.send({
      success: true,
      data: comments,
      total,
      hasMore: parseInt(offset) + comments.length < total,
    });
  });

  // POST /tracks/:id/comment
  fastify.post('/tracks/:id/comment', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };
    const { text } = request.body as { text: string };

    if (!text || text.trim().length < 1 || text.length > 1000) {
      return reply.status(400).send({ success: false, error: 'Текст комментария 1-1000 символов', code: 'VALIDATION_ERROR', status: 400 });
    }

    const comment = await db.comment.create({
      data: { userId: payload.userId, trackId: id, text: text.trim() },
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } },
    });

    await db.track.update({ where: { id }, data: { commentCount: { increment: 1 } } });

    return reply.status(201).send({ success: true, data: comment });
  });

  // POST /tracks/upload — загрузка аудио на S3
  fastify.post('/tracks/upload', { preHandler: requireArtist }, async (request, reply) => {
    // TODO: multipart upload в Cloudflare R2
    // Заглушка для разработки
    return reply.send({
      success: true,
      data: {
        audioUrl: `https://cdn.pokayfu.com/audio/mock_${Date.now()}.mp3`,
        coverUrl: null,
        durationSec: 240,
      },
    });
  });

  // POST /tracks — создание трека + запуск деплоя токена
  fastify.post('/tracks', { preHandler: requireArtist }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const body = CreateTrackSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error:   body.error.errors.map(e => e.message).join(', '),
        code:    'VALIDATION_ERROR',
        status:  400,
      });
    }

    const artist = await db.artist.findUnique({ where: { userId: payload.userId } });
    if (!artist) {
      return reply.status(403).send({ success: false, error: 'Не артист', code: 'FORBIDDEN', status: 403 });
    }

    // Создаём трек в БД
    const track = await db.track.create({
      data: { ...body.data, artistId: artist.id, status: 'PENDING' },
      include: { artist: { include: { user: true } } },
    });

    // Генерируем тикер из названия
    const ticker = generateTicker(body.data.title);

    // Ставим задачу деплоя в очередь
    await deployTokenQueue.add(
      'deploy-track-token',
      {
        trackId:         track.id,
        artistId:        artist.id,
        ticker,
        artistTonWallet: '', // TODO: получать из профиля артиста
      },
      { priority: 1 }
    );

    return reply.status(201).send({
      success: true,
      data: {
        ...track,
        ticker,
        message: 'Трек создан, токен деплоится. Займёт 2-5 минут.',
      },
    });
  });
}

// ── HELPERS ────────────────────────────────────

function countryToFlag(country: string): string {
  const flags: Record<string, string> = {
    'RU': '🇷🇺', 'UA': '🇺🇦', 'KZ': '🇰🇿', 'BY': '🇧🇾',
    'US': '🇺🇸', 'DE': '🇩🇪', 'GB': '🇬🇧',
  };
  return flags[country] || '🌐';
}

function generateRetentionCurve(plays: { durationSec: number; completed: boolean }[], totalSec: number): number[] {
  // Упрощённая retention curve: 10 точек
  if (plays.length === 0) return new Array(10).fill(0);

  return Array.from({ length: 10 }, (_, i) => {
    const threshold = (totalSec / 10) * (i + 1);
    const reached = plays.filter(p => p.durationSec >= threshold).length;
    return Math.round((reached / plays.length) * 100);
  });
}
