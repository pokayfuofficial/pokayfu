CREATE TYPE "UserRole" AS ENUM ('LISTENER', 'ARTIST', 'ADMIN');
CREATE TYPE "TrackStatus" AS ENUM ('PENDING', 'DEPLOYING', 'ACTIVE', 'FAILED', 'REMOVED');
CREATE TYPE "Genre" AS ENUM ('HIP_HOP', 'ELECTRONIC', 'POP', 'RNB', 'ROCK', 'INDIE', 'TRAP', 'HOUSE', 'OTHER');
CREATE TYPE "TokenType" AS ENUM ('TRACK', 'ARTIST');
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');
CREATE TYPE "ChartType" AS ENUM ('HOT', 'RISING', 'HOLDERS', 'NEW', 'VOLUME', 'GENRE', 'FOR_YOU', 'REGION');
CREATE TYPE "Region" AS ENUM ('RU', 'CIS', 'WORLD');
CREATE TYPE "RoyaltyStatus" AS ENUM ('PENDING', 'CLAIMED');
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "telegram_id" TEXT NOT NULL,
  "username" TEXT,
  "name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'LISTENER',
  "referral_code" TEXT NOT NULL,
  "referred_by_id" TEXT,
  "is_premium" BOOLEAN NOT NULL DEFAULT false,
  "premium_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
CREATE TABLE "artists" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bio" TEXT,
  "genres" "Genre"[],
  "country" TEXT,
  "social_telegram" TEXT,
  "social_vk" TEXT,
  "social_instagram" TEXT,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "registration_tx_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "artists_user_id_key" ON "artists"("user_id");
CREATE TABLE "tracks" (
  "id" TEXT NOT NULL,
  "artist_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "genre" "Genre" NOT NULL,
  "year" INTEGER NOT NULL,
  "lyrics" TEXT,
  "audio_url" TEXT NOT NULL,
  "cover_url" TEXT,
  "duration_sec" INTEGER NOT NULL,
  "status" "TrackStatus" NOT NULL DEFAULT 'PENDING',
  "total_plays" INTEGER NOT NULL DEFAULT 0,
  "unique_listeners" INTEGER NOT NULL DEFAULT 0,
  "completion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "library_count" INTEGER NOT NULL DEFAULT 0,
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "comment_count" INTEGER NOT NULL DEFAULT 0,
  "share_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "track_tokens" (
  "id" TEXT NOT NULL,
  "track_id" TEXT NOT NULL,
  "contract_address" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,
  "total_supply" TEXT NOT NULL DEFAULT '1000000000',
  "current_price_ton" TEXT NOT NULL DEFAULT '0.000001',
  "price_change_24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "holder_count" INTEGER NOT NULL DEFAULT 0,
  "volume_24h" TEXT NOT NULL DEFAULT '0',
  "market_cap_ton" TEXT NOT NULL DEFAULT '0',
  "lp_locked" BOOLEAN NOT NULL DEFAULT false,
  "lp_locked_at" TIMESTAMP(3),
  "lp_tx_hash" TEXT,
  "lp_amount" TEXT,
  "deploy_tx_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "track_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "track_tokens_track_id_key" ON "track_tokens"("track_id");
CREATE UNIQUE INDEX "track_tokens_contract_address_key" ON "track_tokens"("contract_address");
CREATE TABLE "artist_tokens" (
  "id" TEXT NOT NULL,
  "artist_id" TEXT NOT NULL,
  "contract_address" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,
  "total_supply" TEXT NOT NULL DEFAULT '100000000',
  "current_price_ton" TEXT NOT NULL DEFAULT '0.000001',
  "price_change_24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "holder_count" INTEGER NOT NULL DEFAULT 0,
  "volume_24h" TEXT NOT NULL DEFAULT '0',
  "market_cap_ton" TEXT NOT NULL DEFAULT '0',
  "lp_locked" BOOLEAN NOT NULL DEFAULT false,
  "lp_locked_at" TIMESTAMP(3),
  "lp_tx_hash" TEXT,
  "royalty_flow_7d" TEXT NOT NULL DEFAULT '0',
  "deploy_tx_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "artist_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "artist_tokens_artist_id_key" ON "artist_tokens"("artist_id");
CREATE UNIQUE INDEX "artist_tokens_contract_address_key" ON "artist_tokens"("contract_address");
CREATE TABLE "token_holders" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_type" "TokenType" NOT NULL,
  "track_token_id" TEXT,
  "artist_token_id" TEXT,
  "amount" TEXT NOT NULL,
  "avg_buy_price" TEXT NOT NULL DEFAULT '0',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "token_holders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "price_history" (
  "id" TEXT NOT NULL,
  "track_token_id" TEXT NOT NULL,
  "price_ton" TEXT NOT NULL,
  "volume_ton" TEXT NOT NULL DEFAULT '0',
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "token_type" "TokenType" NOT NULL,
  "track_token_id" TEXT,
  "artist_token_id" TEXT,
  "amount_ton" TEXT NOT NULL,
  "tokens_count" TEXT NOT NULL,
  "price_ton" TEXT NOT NULL,
  "tx_hash" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");
CREATE TABLE "plays" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "track_id" TEXT NOT NULL,
  "duration_sec" INTEGER NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "country" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plays_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "royalty_payouts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "track_token_id" TEXT NOT NULL,
  "amount_ton" TEXT NOT NULL,
  "status" "RoyaltyStatus" NOT NULL DEFAULT 'PENDING',
  "tx_hash" TEXT,
  "claimed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "royalty_payouts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "chart_snapshots" (
  "id" TEXT NOT NULL,
  "track_id" TEXT NOT NULL,
  "chart_type" "ChartType" NOT NULL,
  "genre" "Genre",
  "region" "Region",
  "score" DOUBLE PRECISION NOT NULL,
  "rank" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chart_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "follows" (
  "id" TEXT NOT NULL,
  "follower_id" TEXT NOT NULL,
  "artist_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "follows_follower_id_artist_id_key" ON "follows"("follower_id","artist_id");
CREATE TABLE "likes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "track_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "likes_user_id_track_id_key" ON "likes"("user_id","track_id");
CREATE TABLE "comments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "track_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "artists" ADD CONSTRAINT "artists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "track_tokens" ADD CONSTRAINT "track_tokens_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "artist_tokens" ADD CONSTRAINT "artist_tokens_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "token_holders" ADD CONSTRAINT "token_holders_user_track_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_track_token_id_fkey" FOREIGN KEY ("track_token_id") REFERENCES "track_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plays" ADD CONSTRAINT "plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plays" ADD CONSTRAINT "plays_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "royalty_payouts" ADD CONSTRAINT "royalty_payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "royalty_payouts" ADD CONSTRAINT "royalty_payouts_track_token_id_fkey" FOREIGN KEY ("track_token_id") REFERENCES "track_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chart_snapshots" ADD CONSTRAINT "chart_snapshots_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
