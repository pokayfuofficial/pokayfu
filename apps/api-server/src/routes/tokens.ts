import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { cacheGetOrSet, CacheKeys } from '../cache/redis';
import { estimateBuy, getTokenPrice } from '../utils/bonding-curve';

const BuyEstimateSchema = z.object({
  amountTon: z.string().min(1),
  slippage:  z.number().min(0.1).max(5).optional().default(0.5),
});

export async function tokenRoutes(fastify: FastifyInstance) {

  // GET /tokens/track/:id — данные токена трека
  fastify.get('/tokens/track/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
      include: {
        track: {
          include: {
            artist: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } } },
          },
        },
      },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: token });
  });

  // GET /tokens/artist/:id — данные Artist Token
  fastify.get('/tokens/artist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const token = await db.artistToken.findFirst({
      where: { OR: [{ id }, { artistId: id }] },
      include: {
        artist: {
          include: {
            user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Artist Token не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: token });
  });

  // POST /tokens/track/:id/buy — инициировать покупку
  fastify.post('/tokens/track/:id/buy', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };
    const body = BuyEstimateSchema.safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Неверные параметры', code: 'VALIDATION_ERROR', status: 400 });
    }

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    const amountTon = parseFloat(body.data.amountTon);
    if (isNaN(amountTon) || amountTon <= 0) {
      return reply.status(400).send({ success: false, error: 'Неверная сумма', code: 'VALIDATION_ERROR', status: 400 });
    }

    // Оцениваем покупку через bonding curve
    const currentSold = parseInt(token.totalSupply) - 1_000_000_000; // TODO: реальный supply sold
    const estimate = estimateBuy(Math.max(0, currentSold), amountTon, body.data.slippage);

    // Генерируем idempotency key
    const idempotencyKey = `buy_${payload.userId}_${token.id}_${Date.now()}`;

    // Создаём pending транзакцию
    const transaction = await db.transaction.create({
      data: {
        userId:         payload.userId,
        type:           'BUY',
        tokenType:      'TRACK',
        trackTokenId:   token.id,
        amountTon:      body.data.amountTon,
        tokensCount:    String(estimate.tokensOut),
        priceTon:       String(estimate.pricePerToken),
        idempotencyKey,
      },
    });

    // Формируем TON Connect payload для фронта
    // Фронт отправит транзакцию через TON Connect и вернёт txHash
    const tonConnectPayload = buildBuyPayload(token.contractAddress, amountTon, estimate.minTokensOut);

    return reply.send({
      success: true,
      data: {
        transactionId:   transaction.id,
        estimate,
        tonConnectPayload,
        contractAddress: token.contractAddress,
      },
    });
  });

  // POST /tokens/track/:id/buy/confirm — подтверждение после TON Connect
  fastify.post('/tokens/track/:id/buy/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const { transactionId, txHash } = request.body as { transactionId: string; txHash: string };

    const tx = await db.transaction.findFirst({
      where: { id: transactionId, userId: payload.userId },
      include: { trackToken: true },
    });

    if (!tx || !tx.trackToken) {
      return reply.status(404).send({ success: false, error: 'Транзакция не найдена', code: 'NOT_FOUND', status: 404 });
    }

    // TODO: Верифицировать txHash в TON блокчейне

    // Обновляем транзакцию
    await db.transaction.update({
      where: { id: transactionId },
      data:  { txHash },
    });

    // Обновляем или создаём holding
    const existing = await db.tokenHolder.findFirst({
      where: { userId: payload.userId, trackTokenId: tx.trackToken.id },
    });

    if (existing) {
      const newAmount = BigInt(existing.amount) + BigInt(tx.tokensCount);
      await db.tokenHolder.update({
        where: { id: existing.id },
        data:  { amount: String(newAmount) },
      });
    } else {
      await db.tokenHolder.create({
        data: {
          userId:        payload.userId,
          tokenType:     'TRACK',
          trackTokenId:  tx.trackToken.id,
          amount:        tx.tokensCount,
          avgBuyPrice:   tx.priceTon,
        },
      });

      // Инкремент счётчика холдеров
      await db.trackToken.update({
        where: { id: tx.trackToken.id },
        data:  { holderCount: { increment: 1 } },
      });
    }

    return reply.send({ success: true, data: { confirmed: true, txHash } });
  });

  // POST /tokens/track/:id/sell
  fastify.post('/tokens/track/:id/sell', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as { userId: string };
    const { tokensAmount } = request.body as { tokensAmount: string };

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    const holder = await db.tokenHolder.findFirst({
      where: { userId: payload.userId, trackTokenId: token.id },
    });

    if (!holder || BigInt(holder.amount) < BigInt(tokensAmount)) {
      return reply.status(400).send({
        success: false,
        error:   'Недостаточно токенов для продажи',
        code:    'INSUFFICIENT_TOKENS',
        status:  400,
      });
    }

    // TODO: Реальная продажа через STON.FI SDK

    // Формируем STON.FI swap payload
    const stonfiPayload = buildSellPayload(token.contractAddress, tokensAmount);

    return reply.send({
      success: true,
      data: {
        stonfiPayload,
        contractAddress: token.contractAddress,
        message: 'Подтвердите продажу через STON.FI в вашем кошельке',
      },
    });
  });

  // GET /tokens/track/:id/holders — топ-100 держателей
  fastify.get('/tokens/track/:id/holders', async (request, reply) => {
    const { id } = request.params as { id: string };

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    const holders = await db.tokenHolder.findMany({
      where: { trackTokenId: token.id },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
      },
      orderBy: { amount: 'desc' },
      take: 100,
    });

    const total = holders.reduce((s: bigint, h: any) => s + BigInt(h.amount), BigInt(0));

    const result = holders.map((h: any, i: number) => ({
      rank:       i + 1,
      user:       h.user,
      amount:     h.amount,
      percentage: total > BigInt(0)
        ? Number((BigInt(h.amount) * BigInt(10000)) / total) / 100
        : 0,
    }));

    return reply.send({ success: true, data: result });
  });

  // GET /tokens/track/:id/price-history
  fastify.get('/tokens/track/:id/price-history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { period = '7d' } = request.query as { period?: string };

    const periodMap: Record<string, number> = {
      '24h': 1, '7d': 7, '30d': 30, 'all': 365,
    };
    const days = periodMap[period] ?? 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    const history = await db.priceHistory.findMany({
      where: { trackTokenId: token.id, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    });

    return reply.send({ success: true, data: history });
  });

  // GET /tokens/track/:id/transactions
  fastify.get('/tokens/track/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '20', offset = '0' } = request.query as any;

    const token = await db.trackToken.findFirst({
      where: { OR: [{ id }, { trackId: id }] },
    });

    if (!token) {
      return reply.status(404).send({ success: false, error: 'Токен не найден', code: 'NOT_FOUND', status: 404 });
    }

    const [txs, total] = await Promise.all([
      db.transaction.findMany({
        where: { trackTokenId: token.id },
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      db.transaction.count({ where: { trackTokenId: token.id } }),
    ]);

    return reply.send({ success: true, data: txs, total, hasMore: parseInt(offset) + txs.length < total });
  });

  // POST /tokens/royalty/claim — вывод Royalty Flow
  fastify.post('/tokens/royalty/claim', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };

    const pending = await db.royaltyPayout.findMany({
      where: { userId: payload.userId, status: 'PENDING' },
    });

    if (pending.length === 0) {
      return reply.send({ success: true, data: { claimed: '0', message: 'Нет доступных роялти' } });
    }

    const total = pending.reduce((s: number, p: any) => s + parseFloat(p.amountTon), 0);

    // TODO: Реальный вывод через смарт-контракт RoyaltyDistributor
    await db.royaltyPayout.updateMany({
      where: { userId: payload.userId, status: 'PENDING' },
      data:  { status: 'CLAIMED', claimedAt: new Date() },
    });

    return reply.send({
      success: true,
      data: {
        claimed:  total.toFixed(8),
        payouts:  pending.length,
        message:  `${total.toFixed(4)} TON будет отправлено на ваш кошелёк`,
      },
    });
  });
}

// ── TON CONNECT PAYLOAD BUILDERS ───────────────

function buildBuyPayload(contractAddress: string, amountTon: number, minTokensOut: number) {
  // TODO: Реальный TON Connect payload для покупки через STON.FI
  return {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{
      address: contractAddress,
      amount:  String(Math.floor(amountTon * 1e9)), // наноТОНы
      payload: 'te6cckE...', // TODO: base64 BoC для STON.FI swap
    }],
  };
}

function buildSellPayload(contractAddress: string, tokensAmount: string) {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{
      address: contractAddress,
      amount:  '50000000', // 0.05 TON на газ
      payload: 'te6cckE...', // TODO: base64 BoC для transfer + sell
    }],
  };
}
