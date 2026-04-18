// ─────────────────────────────────────────────
//  POKAYFU — Shared Types
//  Используется на фронте, бэке и воркерах
// ─────────────────────────────────────────────

// ── ENUMS ──────────────────────────────────────

export enum UserRole {
  LISTENER = 'LISTENER',
  ARTIST   = 'ARTIST',
  ADMIN    = 'ADMIN',
}

export enum TrackStatus {
  PENDING    = 'PENDING',    // загружен, ожидает деплоя токена
  DEPLOYING  = 'DEPLOYING',  // деплой в процессе
  ACTIVE     = 'ACTIVE',     // токен задеплоен, доступен
  FAILED     = 'FAILED',     // деплой упал
  REMOVED    = 'REMOVED',    // удалён артистом
}

export enum Genre {
  HIP_HOP    = 'HIP_HOP',
  ELECTRONIC = 'ELECTRONIC',
  POP        = 'POP',
  RNB        = 'RNB',
  ROCK       = 'ROCK',
  INDIE      = 'INDIE',
  TRAP       = 'TRAP',
  HOUSE      = 'HOUSE',
  OTHER      = 'OTHER',
}

export enum TokenType {
  TRACK  = 'TRACK',
  ARTIST = 'ARTIST',
}

export enum TransactionType {
  BUY  = 'BUY',
  SELL = 'SELL',
}

export enum ChartType {
  HOT      = 'HOT',
  RISING   = 'RISING',
  HOLDERS  = 'HOLDERS',
  NEW      = 'NEW',
  VOLUME   = 'VOLUME',
  GENRE    = 'GENRE',
  FOR_YOU  = 'FOR_YOU',
  REGION   = 'REGION',
}

export enum Region {
  RU    = 'RU',
  CIS   = 'CIS',
  WORLD = 'WORLD',
}

export enum Period {
  DAY   = '24h',
  WEEK  = '7d',
  MONTH = '30d',
  ALL   = 'all',
}

// ── USER ───────────────────────────────────────

export interface User {
  id:            string;
  telegramId:    string;
  username:      string | null;
  name:          string;
  avatarUrl:     string | null;
  role:          UserRole;
  referralCode:  string;
  referredBy:    string | null;
  isPremium:     boolean;
  premiumUntil:  string | null;
  createdAt:     string;
}

export interface UserPublic {
  id:        string;
  name:      string;
  username:  string | null;
  avatarUrl: string | null;
  role:      UserRole;
}

// ── ARTIST ─────────────────────────────────────

export interface Artist {
  id:               string;
  userId:           string;
  user:             UserPublic;
  bio:              string | null;
  genres:           Genre[];
  country:          string | null;
  socialTelegram:   string | null;
  socialVk:         string | null;
  socialInstagram:  string | null;
  isVerified:       boolean;
  artistToken:      ArtistToken | null;
  trackCount:       number;
  followerCount:    number;
  totalPlays:       number;
  createdAt:        string;
}

// ── TRACK ──────────────────────────────────────

export interface Track {
  id:           string;
  artistId:     string;
  artist:       Artist;
  title:        string;
  genre:        Genre;
  year:         number;
  lyrics:       string | null;
  audioUrl:     string;
  coverUrl:     string | null;
  durationSec:  number;
  status:       TrackStatus;
  trackToken:   TrackToken | null;
  // Музыкальные метрики
  totalPlays:      number;
  uniqueListeners: number;
  completionRate:  number; // 0-100 %
  libraryCount:    number;
  likeCount:       number;
  commentCount:    number;
  shareCount:      number;
  createdAt:       string;
}

export interface TrackShort {
  id:          string;
  title:       string;
  genre:       Genre;
  coverUrl:    string | null;
  durationSec: number;
  artist:      { id: string; user: UserPublic };
  trackToken:  TrackTokenShort | null;
  totalPlays:  number;
  likeCount:   number;
}

// ── TRACK TOKEN ────────────────────────────────

export interface TrackToken {
  id:               string;
  trackId:          string;
  contractAddress:  string;
  ticker:           string;       // напр. $NDRIFT
  totalSupply:      string;       // "1000000000"
  currentPriceTon:  string;       // "0.012"
  priceChange24h:   number;       // +24.5 или -3.1
  holderCount:      number;
  volume24h:        string;       // в TON
  marketCapTon:     string;
  lpLocked:         boolean;
  lpLockedAt:       string | null;
  lpTxHash:         string | null;
  createdAt:        string;
}

export interface TrackTokenShort {
  contractAddress:  string;
  ticker:           string;
  currentPriceTon:  string;
  priceChange24h:   number;
  holderCount:      number;
  lpLocked:         boolean;
}

// ── ARTIST TOKEN ───────────────────────────────

export interface ArtistToken {
  id:               string;
  artistId:         string;
  contractAddress:  string;
  ticker:           string;
  totalSupply:      string;       // "100000000"
  currentPriceTon:  string;
  priceChange24h:   number;
  holderCount:      number;
  volume24h:        string;
  marketCapTon:     string;
  lpLocked:         boolean;
  royaltyFlow7d:    string;       // суммарный Royalty Flow за 7 дней в TON
  createdAt:        string;
}

// ── TOKEN HOLDER ───────────────────────────────

export interface TokenHolder {
  rank:       number;
  user:       UserPublic;
  amount:     string;    // количество токенов
  percentage: number;    // доля в %
}

// ── PRICE HISTORY ──────────────────────────────

export interface PricePoint {
  timestamp:   string;
  priceTon:    string;
  volumeTon:   string;
}

// ── TRANSACTION ────────────────────────────────

export interface TokenTransaction {
  id:            string;
  user:          UserPublic;
  type:          TransactionType;
  amountTon:     string;
  tokensCount:   string;
  priceTon:      string;
  txHash:        string;
  createdAt:     string;
}

// ── PLAY / ANALYTICS ───────────────────────────

export interface PlayRecord {
  id:          string;
  userId:      string;
  trackId:     string;
  durationSec: number;
  completed:   boolean;
  country:     string | null;
  createdAt:   string;
}

export interface TrackAnalytics {
  trackId:          string;
  // Прослушивания
  totalPlays:        number;
  playsToday:        number;
  plays24h:          number;
  plays7d:           number;
  plays30d:          number;
  uniqueListeners:   number;
  completionRate:    number;
  avgListenSec:      number;
  // По дням (для графика)
  playsByDay:        { date: string; plays: number }[];
  // Retention (по секундам трека, нормализованный 0-100%)
  retentionCurve:    number[];
  // География
  geography:         { country: string; flag: string; percentage: number }[];
  // Социальные
  likeCount:         number;
  commentCount:      number;
  shareCount:        number;
  repostCount:       number;
  libraryCount:      number;
  // Новые держатели за периоды
  newHolders24h:     number;
  newHolders7d:      number;
}

// ── CHART ──────────────────────────────────────

export interface ChartEntry {
  rank:        number;
  prevRank:    number | null;  // null = NEW
  track:       TrackShort;
  hotScore:    number;
  // Метрики для отображения
  plays24h:    number;
  tokenChange: number;         // % рост токена
  holderCount: number;
  volume24h:   string;
}

export interface ChartResponse {
  type:      ChartType;
  region:    Region;
  period:    Period;
  updatedAt: string;
  entries:   ChartEntry[];
}

// ── PORTFOLIO / LIBRARY ────────────────────────

export interface UserPortfolio {
  totalValueTon:       string;
  totalValueRub:       number;
  pnlTon:              string;
  pnlPercent:          number;
  artistTokensValue:   string;
  trackTokensValue:    string;
  royaltyEarned:       string;
  trackTokenHoldings:  TrackHolding[];
  artistTokenHoldings: ArtistHolding[];
}

export interface TrackHolding {
  track:        TrackShort;
  tokenAmount:  string;
  ticker:       string;
  currentPrice: string;
  totalValue:   string;
  pnlPercent:   number;
  hasAccess:    boolean;
}

export interface ArtistHolding {
  artist:           { id: string; user: UserPublic };
  tokenAmount:      string;
  ticker:           string;
  currentPrice:     string;
  totalValue:       string;
  pnlPercent:       number;
  pendingRoyalty:   string;
  royaltyFlowActive: boolean;
}

// ── ROYALTY ────────────────────────────────────

export interface RoyaltyPayout {
  id:          string;
  trackTitle:  string;
  artistName:  string;
  amountTon:   string;
  txHash:      string | null;
  status:      'PENDING' | 'CLAIMED';
  createdAt:   string;
}

// ── COMMENT ────────────────────────────────────

export interface Comment {
  id:        string;
  user:      UserPublic;
  text:      string;
  createdAt: string;
}

// ── AUTH ───────────────────────────────────────

export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  user:         User;
}

export interface TelegramAuthData {
  initData: string;
}

// ── API RESPONSES ──────────────────────────────

export interface ApiResponse<T> {
  data:    T;
  success: true;
}

export interface ApiError {
  success: false;
  error:   string;
  code:    string;
  status:  number;
}

export interface PaginatedResponse<T> {
  data:    T[];
  total:   number;
  page:    number;
  limit:   number;
  hasMore: boolean;
}

// ── QUEUE JOBS ─────────────────────────────────

export interface DeployTokenJob {
  trackId:    string;
  artistId:   string;
  ticker:     string;
  artistTonWallet: string;
}

export interface RoyaltyDistributeJob {
  trackTokenId:   string;
  artistTokenId:  string;
  amountTon:      string;
  txHash:         string;
}

// ── ACCESS ─────────────────────────────────────

export interface AccessCheck {
  trackId:      string;
  hasAccess:    boolean;
  tokenValue:   number;    // в рублях
  threshold:    number;    // 15 рублей
  tokensOwned:  string;
  currentPrice: string;
}

// ── BONDING CURVE ──────────────────────────────

export interface BondingCurveParams {
  basePrice: string;  // "0.000001"
  slope:     string;  // "0.0000000001"
}

export interface BuyEstimate {
  tokensOut:     string;
  pricePerToken: string;
  totalTon:      string;
  priceImpact:   number;
  slippage:      number;
}
