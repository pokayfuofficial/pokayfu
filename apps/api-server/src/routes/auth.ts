import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  verifyTelegramInitData,
  parseTelegramInitData,
  findOrCreateUser,
  requireAuth,
} from '../middleware/auth';

const TelegramAuthSchema = z.object({
  initData: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {

  // POST /auth/telegram
  // Авторизация через Telegram initData
  fastify.post('/telegram', async (request, reply) => {
    const body = TelegramAuthSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error:   'Неверный формат initData',
        code:    'VALIDATION_ERROR',
        status:  400,
      });
    }

    const { initData } = body.data;
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;

    // В dev режиме пропускаем проверку для тестирования
    if (process.env.NODE_ENV !== 'development') {
      const isValid = verifyTelegramInitData(initData, botToken);
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error:   'Неверная подпись Telegram',
          code:    'INVALID_TELEGRAM_SIGNATURE',
          status:  401,
        });
      }
    }

    const tgUser = parseTelegramInitData(initData);
    if (!tgUser) {
      // В dev режиме создаём тестового пользователя
      if (process.env.NODE_ENV === 'development') {
        const testUser = await findOrCreateUser({
          id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
        });

        const accessToken = fastify.jwt.sign(
          { userId: testUser.id, role: testUser.role },
          { expiresIn: '7d' }
        );

        return reply.send({
          success: true,
          data: { accessToken, user: testUser },
        });
      }

      return reply.status(400).send({
        success: false,
        error:   'Не удалось получить данные пользователя',
        code:    'PARSE_ERROR',
        status:  400,
      });
    }

    const user = await findOrCreateUser(tgUser);

    const accessToken = fastify.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: '7d' }
    );

    const refreshToken = fastify.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id:           user.id,
          name:         user.name,
          username:     user.username,
          avatarUrl:    user.avatarUrl,
          role:         user.role,
          referralCode: user.referralCode,
          isPremium:    user.isPremium,
          createdAt:    user.createdAt,
        },
      },
    });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const body = RefreshSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Неверный токен', code: 'VALIDATION_ERROR', status: 400 });
    }

    try {
      const payload = fastify.jwt.verify(body.data.refreshToken) as { userId: string; type: string };
      if (payload.type !== 'refresh') throw new Error('Wrong token type');

      const { db } = await import('../db/client');
      const user = await db.user.findUnique({ where: { id: payload.userId } });
      if (!user) throw new Error('User not found');

      const accessToken = fastify.jwt.sign(
        { userId: user.id, role: user.role },
        { expiresIn: '7d' }
      );

      return reply.send({ success: true, data: { accessToken } });
    } catch {
      return reply.status(401).send({ success: false, error: 'Токен недействителен', code: 'INVALID_TOKEN', status: 401 });
    }
  });

  // GET /auth/me
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const { db } = await import('../db/client');

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { artist: { include: { artistToken: true } } },
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: 'Пользователь не найден', code: 'NOT_FOUND', status: 404 });
    }

    return reply.send({ success: true, data: user });
  });
}
