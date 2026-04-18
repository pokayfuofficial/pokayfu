# 🎵 Pokayfu

**Первая платформа токенизации музыки на блокчейне TON**

Музыкальный стриминговый сервис где каждый трек и артист имеют уникальные токены с автоматической вечной блокировкой ликвидности. Работает как Telegram Mini App.

---

## 🚀 Быстрый старт (Development)

### Требования
- Node.js 21+
- Docker & Docker Compose
- npm 10+

### 1. Клонировать и установить зависимости
```bash
git clone https://github.com/your-org/pokayfu
cd pokayfu
npm install
```

### 2. Запустить инфраструктуру
```bash
docker compose up -d
# PostgreSQL :5432 | Redis :6379 | MinIO :9000
```

### 3. Настроить переменные окружения
```bash
cp apps/api-server/.env.example apps/api-server/.env
# Отредактировать .env (минимум: DATABASE_URL, REDIS_URL, JWT_SECRET)
```

### 4. Запустить миграции БД
```bash
npm run db:migrate
npm run db:generate
```

### 5. Запустить сервисы
```bash
# Все сервисы одновременно
npm run dev

# Или по отдельности:
cd apps/api-server && npm run dev    # :3001
cd apps/mini-app   && npm run dev    # :5173
```

---

## 🏗 Архитектура

```
pokayfu/
├── apps/
│   ├── api-server/          # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/      # auth, tracks, artists, tokens, charts, users
│   │   │   ├── services/    # charts, cron
│   │   │   ├── workers/     # BullMQ: deployToken
│   │   │   ├── blockchain/  # TON client, STON.FI service
│   │   │   ├── db/          # Prisma client
│   │   │   └── cache/       # Redis helpers
│   │   └── prisma/
│   │       └── schema.prisma  # 12 таблиц
│   │
│   └── mini-app/            # React Telegram Mini App
│       └── src/
│           ├── screens/     # Home, Charts, Track, Buy, Artist, Library, Profile, Upload
│           ├── components/  # UI, Player, TrackCard
│           ├── stores/      # Zustand: auth, player, ui
│           ├── hooks/       # useAuth, usePlayer
│           └── api/         # Axios client
│
├── contracts/               # Tact смарт-контракты
│   ├── track-token/         # TrackToken.tact (TEP-74 + bonding curve)
│   ├── artist-token/        # ArtistToken.tact (+ Royalty Flow)
│   ├── liquidity-lock/      # LiquidityLock.tact (вечная блокировка)
│   ├── royalty-distributor/ # RoyaltyDistributor.tact
│   └── tests/               # 22 теста (все проходят ✅)
│
└── packages/
    └── shared-types/        # TypeScript типы для всего монорепо
```

---

## ⛓ Смарт-контракты

### TrackToken (TEP-74 Jetton)
- **Эмиссия**: 1 000 000 000 токенов
- **Ценообразование**: Bonding curve `price = 1000 + 100 × sold / 1M`
- **Комиссия**: 1.25% (1% артисту, 0.25% платформе)
- **Доступ**: `hasAccess()` — стоимость токенов ≥ ~15 руб

### ArtistToken
- **Эмиссия**: 100 000 000 (50% публично, 30% LP, 20% артисту)
- **Royalty Flow**: 0.25% от каждой сделки Track Token → держателям Artist Token

### LiquidityLock
- Хранит LP токены навсегда
- `WithdrawLiquidity` → всегда `LOCK_IS_PERMANENT`
- Rug pull математически невозможен

### RoyaltyDistributor
- Accumulator pattern для пропорционального распределения
- `ClaimRoyalty` — вывод накопленных TON

---

## 📊 Чарты (8 типов)

| Тип | Алгоритм |
|-----|---------|
| 🔥 Горячие | `plays×0.5 + token_growth×0.3 + holders×0.2` |
| 📈 Растущие | Сортировка по росту цены токена |
| 💎 Топ холдеров | По количеству держателей токена |
| ⚡ Новинки | Треки до 7 дней, сортировка по прослушиваниям |
| 💰 Объём | По объёму торгов в TON за период |
| 🎵 По жанрам | Hot score внутри каждого жанра |
| 🎯 Для тебя | Персональные рекомендации |
| 🌍 По регионам | RU / СНГ / Мир |

Обновление каждые **15 минут** через cron.

---

## 💰 Монетизация

| Источник | Ставка | Кому |
|---------|--------|------|
| Регистрация артиста | 50 TON | Платформе |
| Сделка Track Token | 1.25% | 1% артисту, 0.25% платформе |
| Сделка Artist Token | 2% | 1.5% артисту, 0.5% платформе |
| Royalty Flow | 0.25% от трека | Держателям Artist Token |
| Premium подписка | 9.9 TON/мес | 70% платформе, 30% пулу артистов |

---

## 🔑 Переменные окружения

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TON_MNEMONIC=word1 word2 ... word24
TON_API_KEY=...
STONFI_ROUTER_ADDRESS=EQ...
LIQUIDITY_LOCK_ADDRESS=EQ...
PLATFORM_WALLET_ADDRESS=EQ...
COINGECKO_API_KEY=...
S3_ENDPOINT=...
S3_BUCKET=pokayfu-media
```

---

## 🧪 Тесты

```bash
# Контракты (22 теста)
cd contracts && npx jest

# API (после настройки БД)
cd apps/api-server && npm test
```

---

## 🚢 Деплой

```bash
# Staging
docker compose -f docker-compose.prod.yml up -d

# Production (через GitHub Actions)
git push origin main
# → CI/CD автоматически деплоит через SSH
```

---

## 📱 Telegram Mini App

Регистрация бота: [@BotFather](https://t.me/BotFather)

```
/newbot → получить токен
/newapp → создать Mini App
URL приложения: https://pokayfu.com
```

---

## 🛣 Roadmap

- [x] Этап 1 — Фундамент (API, БД, авторизация)
- [x] Этап 2 — Mini App (9 экранов)
- [x] Этап 3 — Смарт-контракты (4 контракта, 22 теста)
- [x] Этап 4 — Чарты и аналитика
- [x] Этап 5 — CI/CD и деплой
- [ ] Этап 6 — iOS/Android нативные приложения
- [ ] Этап 7 — ML рекомендации
- [ ] Этап 8 — Публичный запуск

---

*Pokayfu © 2026 — Музыка будущего на блокчейне TON*
