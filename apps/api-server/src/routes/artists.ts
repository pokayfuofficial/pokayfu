import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import { requireAuth, requireArtist } from '../middleware/auth';
import { cacheGetOrSet, cacheDel, CacheKeys } from '../cache/redis';
type Genre = 'HIP_HOP' | 'ELECTRONIC' | 'POP' | 'RNB' | 'ROCK' | 'INDIE' | 'TRAP' | 'HOUSE' | 'OTHER';

const RegisterArtistSchema = z.object({
  bio:             z.string().max(1000).optional(),
  genres:          z.array(z.enum(['HIP_HOP','ELECTRONIC','POP','RNB','ROCK','INDIE','TRAP','HOUSE','OTHER'])).min(1).max(5),
  country:         z.string().max(2).optional(),
  socialTelegram:  z.string().optional(),
  socialVk:        z.string().optional(),
  socialInstagram: z.string().optional(),
  txHash:          z.string(), // подтверждение оплаты 50 TON
});

const UpdateArtistSchema = z.object({
  bio:             z.string().max(1000).optional(),
  genres: z.array(z.enum(['HIP_HOP','ELECTRONIC','POP','RNB','ROCK','INDIE','TRAP','HOUSE','OTHER'])).optional(),
  country:         z.string().max(2).optional(),
  socialTelegram:  z.string().optional(),
  socialVk:        z.string().optional(),
  socialInstagram: z.string().optional(),
});

export async function artistRoutes(fastify: FastifyInstance) {

  // GET /artists/top — топ артистов по объёму
  fastify.get('/artists/top', async (request, reply) => {
    const { limit = '20' } = request.query as any;

    const artists = await db.artist.findMany({
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
        artistToken: true,
        _count: { select: { tracks: true, follows: true } },
      },
      orderBy: { artistToken: { volume24h: 'desc' } },
      take: Math.min(parseInt(limit), 50),
    });

    return reply.send({ success: true, data: artists });
  });

  // GET /artists/search
  fastify.get('/artists/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ success: false, error: 'Минимум 2 символа', code: 'VALIDATION_ERROR', status: 400 });
    }

    const artists = await db.artist.findMany({
      where: {
        user: { name: { contains: q, mode: 'insensitive' } },
      },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
        artistToken: true,
        _count: { select: { tracks: true, follows: true } },
      },
      take: 20,
    });

    return reply.send({ success: true, data: artists });
  });

  // POST /artists/register — регистрация артиста
  fastify.post('/artists/register', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const body = RegisterArtistSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error:   body.error.errors.map(e => e.message).join(', '),
        code:    'VALIDATION_ERROR',
        status:  400,
      });
    }

    // Проверяем что пользователь ещё не артист
    const existing = await db.artist.findUnique({ where: { userId: payload.userId } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error:   'Вы уже зарегистрированы как артист',
        code:    'ALREADY_EXISTS',
        status:  409,
      });
    }

    // TODO: Верифицировать txHash в TON — что действительно пришло 50 TON
    // const verified = await verifyTonTransaction(body.data.txHash, PLATFORM_WALLET, 50);
    // if (!verified) return reply.status(402).send(...)

    const { txHash, ...artistData } = body.data;

    // Создаём артиста и обновляем роль пользователя
    const [artist] = await db.$transaction([
      db.artist.create({
        data: {
          userId: payload.userId,
          ...artistData,
          registrationTxHash: txHash,
        },
        include: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
        },
      }),
      db.user.update({
        where: { id: payload.userId },
        data:  { role: 'ARTIST' },
      }),
    ]);

    // TODO: задеплоить Artist Token через BullMQ

    return reply.status(201).send({ success: true, data: artist });
  });

  // GET /artists/:id — профиль артиста
  fastify.get('/artists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const artist = await cacheGetOrSet(
      CacheKeys.artistProfile(id),
      () => db.artist.findUnique({
        where: { id },
        include: {
          user:        { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
          artistToken: true,
          _count:      { select: { tracks: true, follows: true } },
        },
      }),
      120 // 2 мин кэш
    );

    if (!artist) {
      return reply.status(404).send({ success: false, error: 'Артист не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: artist });
  });

  // PATCH /artists/me — обновление профиля артиста
  fastify.patch('/artists/me', { preHandler: requireArtist }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const body = UpdateArtistSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Ошибка валидации', code: 'VALIDATION_ERROR', status: 400 });
    }

    const artist = await db.artist.findUnique({ where: { userId: payload.userId } });
    if (!artist) {
      return reply.status(404).send({ success: false, error: 'Профиль артиста не найден', code: 'NOT_FOUND', status: 404 });
    }

    const updated = await db.artist.update({
      where: { id: artist.id },
      data:  body.data,
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } }, artistToken: true },
    });

    await cacheDel(CacheKeys.artistProfile(artist.id));

    return reply.send({ success: true, data: updated });
  });

  // GET /artists/:id/tracks — треки артиста
  fastify.get('/artists/:id/tracks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '20', offset = '0' } = request.query as any;

    const [tracks, total] = await Promise.all([
      db.track.findMany({
        where: { artistId: id, status: 'ACTIVE' },
        include: { trackToken: true },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      db.track.count({ where: { artistId: id, status: 'ACTIVE' } }),
    ]);

    return reply.send({ success: true, data: tracks, total, hasMore: parseInt(offset) + tracks.length < total });
  });

  // GET /artists/:id/stats — статистика артиста
  fastify.get('/artists/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [artist, tracks] = await Promise.all([
      db.artist.findUnique({
        where: { id },
        include: { artistToken: true, _count: { select: { follows: true } } },
      }),
      db.track.findMany({
        where: { artistId: id, status: 'ACTIVE' },
        include: { trackToken: true },
      }),
    ]);

    if (!artist) {
      return reply.status(404).send({ success: false, error: 'Артист не найден', code: 'NOT_FOUND', status: 404 });
    }

    const totalPlays   = tracks.reduce((s: number, t: any) => s + t.totalPlays, 0);
    const totalVolume  = tracks.reduce((s: number, t: any) => s + parseFloat(t.trackToken?.volume24h ?? '0'), 0);
    const totalHolders = tracks.reduce((s: number, t: any) => s + (t.trackToken?.holderCount ?? 0), 0);

    return reply.send({
      success: true,
      data: {
        artistId:     id,
        totalTracks:  tracks.length,
        totalPlays,
        totalVolume:  totalVolume.toFixed(4),
        totalHolders,
        followers:    artist._count.follows,
        artistToken:  artist.artistToken,
        royaltyFlow7d: artist.artistToken?.royaltyFlow7d ?? '0',
      },
    });
  });

  // POST /artists/:id/follow — подписка / отписка (toggle)
  fastify.post('/artists/:id/follow', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };

    const existing = await db.follow.findUnique({
      where: { followerId_artistId: { followerId: payload.userId, artistId: id } },
    });

    if (existing) {
      await db.follow.delete({
        where: { followerId_artistId: { followerId: payload.userId, artistId: id } },
      });
      return reply.send({ success: true, data: { following: false } });
    } else {
      await db.follow.create({ data: { followerId: payload.userId, artistId: id } });
      return reply.send({ success: true, data: { following: true } });
    }
  });

  // POST /artists/:id/tip — отправить tip
  fastify.post('/artists/:id/tip', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { amountTon, txHash } = request.body as { amountTon: string; txHash: string };

    // TODO: Верифицировать транзакцию в TON блокчейне
    // Пока просто возвращаем успех

    return reply.send({
      success: true,
      data: { message: `Tip ${amountTon} TON отправлен артисту`, txHash },
    });
  });
}
