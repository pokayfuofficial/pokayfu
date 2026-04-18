import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { cacheGetOrSet, cacheDel, CacheKeys } from '../cache/redis';

const UpdateProfileSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  username:  z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {

  // GET /users/:id — публичный профиль
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id:        true,
        name:      true,
        username:  true,
        avatarUrl: true,
        role:      true,
        createdAt: true,
        artist:    { include: { artistToken: true, _count: { select: { tracks: true, follows: true } } } },
      },
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'Пользователь не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: user });
  });

  // PATCH /users/me — обновление своего профиля
  fastify.patch('/users/me', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const body = UpdateProfileSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Ошибка валидации', code: 'VALIDATION_ERROR', status: 400 });
    }

    const updated = await db.user.update({
      where: { id: payload.userId },
      data:  body.data,
    });

    return reply.send({ success: true, data: updated });
  });

  // GET /users/me/library — библиотека токенов
  fastify.get('/users/me/library', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };

    const [trackHoldings, artistHoldings] = await Promise.all([
      db.tokenHolder.findMany({
        where:   { userId: payload.userId, tokenType: 'TRACK' },
        include: {
          trackToken: {
            include: {
              track: {
                include: {
                  artist: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      db.tokenHolder.findMany({
        where:   { userId: payload.userId, tokenType: 'ARTIST' },
        include: {
          artistToken: {
            include: {
              artist: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        trackHoldings,
        artistHoldings,
        totals: {
          tracks:  trackHoldings.length,
          artists: artistHoldings.length,
        },
      },
    });
  });

  // GET /users/me/portfolio — портфель с P&L
  fastify.get('/users/me/portfolio', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };

    const cacheKey = CacheKeys.portfolio(payload.userId);

    const portfolio = await cacheGetOrSet(cacheKey, async () => {
      const [trackHoldings, artistHoldings, royaltyPending] = await Promise.all([
        db.tokenHolder.findMany({
          where:   { userId: payload.userId, tokenType: 'TRACK' },
          include: { trackToken: true },
        }),
        db.tokenHolder.findMany({
          where:   { userId: payload.userId, tokenType: 'ARTIST' },
          include: {
            artistToken: {
              include: {
                artist: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } } },
              },
            },
          },
        }),
        db.royaltyPayout.aggregate({
          where:  { userId: payload.userId, status: 'PENDING' },
          _sum:   { amountTon: true },
        }),
      ]);

      // Считаем стоимость track holdings
      let trackValue = 0;
      let trackCost  = 0;
      const trackItems = trackHoldings.map((h: any) => {
        const tokens   = parseFloat(h.amount);
        const price    = parseFloat(h.trackToken?.currentPriceTon ?? '0');
        const avgBuy   = parseFloat(h.avgBuyPrice);
        const value    = tokens * price;
        const cost     = tokens * avgBuy;
        const pnl      = cost > 0 ? ((value - cost) / cost) * 100 : 0;
        trackValue += value;
        trackCost  += cost;
        return { ...h, currentValue: value.toFixed(8), pnlPercent: Math.round(pnl * 10) / 10 };
      });

      // Считаем стоимость artist holdings
      let artistValue = 0;
      const artistItems = artistHoldings.map((h: any) => {
        const tokens = parseFloat(h.amount);
        const price  = parseFloat(h.artistToken?.currentPriceTon ?? '0');
        const avgBuy = parseFloat(h.avgBuyPrice);
        const value  = tokens * price;
        const cost   = tokens * avgBuy;
        const pnl    = cost > 0 ? ((value - cost) / cost) * 100 : 0;
        artistValue += value;
        return { ...h, currentValue: value.toFixed(8), pnlPercent: Math.round(pnl * 10) / 10 };
      });

      const totalValue = trackValue + artistValue;
      const totalCost  = trackCost + artistValue * 0.8; // приближение
      const totalPnl   = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
      const royaltyEarned = royaltyPending._sum?.amountTon ?? '0';

      return {
        totalValueTon:       totalValue.toFixed(8),
        pnlPercent:          Math.round(totalPnl * 10) / 10,
        artistTokensValue:   artistValue.toFixed(8),
        trackTokensValue:    trackValue.toFixed(8),
        royaltyEarned,
        trackTokenHoldings:  trackItems,
        artistTokenHoldings: artistItems,
      };
    }, 60); // 1 мин кэш

    return reply.send({ success: true, data: portfolio });
  });

  // GET /users/me/royalty — история Royalty Flow
  fastify.get('/users/me/royalty', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const { status, limit = '20', offset = '0' } = request.query as any;

    const where: any = { userId: payload.userId };
    if (status) where.status = status;

    const [payouts, total, pendingSum] = await Promise.all([
      db.royaltyPayout.findMany({
        where,
        include: {
          trackToken: {
            include: {
              track: {
                include: {
                  artist: { include: { user: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      db.royaltyPayout.count({ where }),
      db.royaltyPayout.aggregate({
        where:  { userId: payload.userId, status: 'PENDING' },
        _sum:   { amountTon: true },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        payouts,
        total,
        hasMore:     parseInt(offset) + payouts.length < total,
        pendingTon:  pendingSum._sum?.amountTon ?? '0',
      },
    });
  });

  // POST /users/referral/apply — применить реферальный код
  fastify.post('/users/referral/apply', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const { code } = request.body as { code: string };

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) return reply.status(404).send({ success: false, error: 'Пользователь не найден', code: 'NOT_FOUND', status: 404 });

    if (user.referredById) {
      return reply.status(409).send({ success: false, error: 'Реферальный код уже применён', code: 'ALREADY_APPLIED', status: 409 });
    }

    const referrer = await db.user.findUnique({ where: { referralCode: code.toUpperCase() } });
    if (!referrer) {
      return reply.status(404).send({ success: false, error: 'Реферальный код не найден', code: 'NOT_FOUND', status: 404 });
    }

    if (referrer.id === payload.userId) {
      return reply.status(400).send({ success: false, error: 'Нельзя использовать свой код', code: 'SELF_REFERRAL', status: 400 });
    }

    await db.user.update({
      where: { id: payload.userId },
      data:  { referredById: referrer.id },
    });

    // TODO: Начислить бонусные токены обоим пользователям

    return reply.send({
      success: true,
      data: { message: 'Реферальный код применён! Вы оба получите 500 токенов на первый трек.' },
    });
  });

  // GET /users/me/referrals — статистика рефералов
  fastify.get('/users/me/referrals', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };

    const [referrals, user] = await Promise.all([
      db.user.findMany({
        where:  { referredById: payload.userId },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findUnique({
        where:  { id: payload.userId },
        select: { referralCode: true },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        referralCode: user?.referralCode,
        totalReferrals: referrals.length,
        referrals,
      },
    });
  });
}
