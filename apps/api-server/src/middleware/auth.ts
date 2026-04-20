import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';
type UserRole = 'LISTENER' | 'ARTIST' | 'ADMIN';

// ── TELEGRAM AUTH VERIFICATION ─────────────────

/**
 * Верифицирует подлинность initData от Telegram Mini App
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');

    // Сортируем параметры и формируем строку для проверки
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // HMAC-SHA256 с ключом из bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return expectedHash === hash;
  } catch {
    return false;
  }
}

/**
 * Парсит initData и возвращает данные пользователя
 */
export function parseTelegramInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(decodeURIComponent(userStr));
  } catch {
    return null;
  }
}

interface TelegramUser {
  id:         number;
  first_name: string;
  last_name?: string;
  username?:  string;
  photo_url?: string;
  language_code?: string;
}

// ── FIND OR CREATE USER ────────────────────────

export async function findOrCreateUser(tgUser: TelegramUser) {
  const telegramId = String(tgUser.id);
  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');

  let user = await db.user.findUnique({
    where: { telegramId },
    include: { artist: true },
  });

  if (!user) {
    // Генерируем уникальный реферальный код
    const referralCode = generateReferralCode(tgUser.id);

    user = await db.user.create({
      data: {
        telegramId,
        name,
        username:     tgUser.username ?? null,
        avatarUrl:    tgUser.photo_url ?? null,
        referralCode,
      },
      include: { artist: true },
    });

    console.log(`[Auth] New user registered: ${name} (${telegramId})`);
  } else {
    // Обновляем данные при каждом входе
    user = await db.user.update({
      where: { telegramId },
      data: {
        name,
        username:  tgUser.username ?? null,
        avatarUrl: tgUser.photo_url ?? null,
      },
      include: { artist: true },
    });
  }

  return user;
}

function generateReferralCode(tgId: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `${String(tgId).slice(-4)}-${suffix}`;
}

// ── FASTIFY MIDDLEWARE ─────────────────────────

/**
 * Проверяет JWT и добавляет user в request
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      success: false,
      error:   'Требуется авторизация',
      code:    'UNAUTHORIZED',
      status:  401,
    });
  }
}

/**
 * Проверяет что пользователь является артистом
 */
export async function requireArtist(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requireAuth(request, reply);

  const payload = request.user as { userId: string; role: string };
  if (payload.role !== 'ARTIST' && payload.role !== 'ADMIN') {
    return reply.status(403).send({
      success: false,
      error:   'Только для артистов',
      code:    'FORBIDDEN',
      status:  403,
    });
  }
}
