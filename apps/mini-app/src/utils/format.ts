// ── ФОРМАТИРОВАНИЕ ─────────────────────────────

export function formatTon(value: string | number, decimals = 4): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '0 TON';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K TON`;
  if (n >= 1)    return `${n.toFixed(decimals)} TON`;
  return `${n.toFixed(8).replace(/\.?0+$/, '')} TON`;
}

export function formatRub(ton: number, rate: number): string {
  const rub = ton * rate;
  if (rub >= 1000000) return `${(rub / 1000000).toFixed(1)}М ₽`;
  if (rub >= 1000)    return `${(rub / 1000).toFixed(1)}К ₽`;
  return `${Math.round(rub)} ₽`;
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)  return 'только что';
  if (min < 60) return `${min} мин назад`;
  if (hr < 24)  return `${hr} ч назад`;
  if (day < 7)  return `${day} дн назад`;
  return formatDate(iso);
}

// ── GENRE LABELS ───────────────────────────────

export const GENRE_LABELS: Record<string, string> = {
  HIP_HOP:    '🎤 Hip-Hop',
  ELECTRONIC: '⚡ Electronic',
  POP:        '🎹 Pop',
  RNB:        '🎷 R&B',
  ROCK:       '🎸 Rock',
  INDIE:      '🎻 Indie',
  TRAP:       '🔊 Trap',
  HOUSE:      '🏠 House',
  OTHER:      '🎵 Другое',
};

export const GENRE_COLORS: Record<string, string> = {
  HIP_HOP:    'from-purple-900 to-pink-600',
  ELECTRONIC: 'from-blue-900 to-cyan-500',
  POP:        'from-yellow-900 to-yellow-400',
  RNB:        'from-red-900 to-pink-500',
  ROCK:       'from-gray-900 to-gray-500',
  INDIE:      'from-green-900 to-emerald-500',
  TRAP:       'from-violet-900 to-purple-500',
  HOUSE:      'from-indigo-900 to-blue-500',
  OTHER:      'from-gray-800 to-gray-600',
};

// ── RANK COLORS ────────────────────────────────

export function getRankColor(rank: number): string {
  if (rank === 1) return '#FFB800';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return 'rgba(240,238,249,0.35)';
}

// ── TOKEN ACCESS ───────────────────────────────

export const ACCESS_THRESHOLD_RUB = 15;

export function checkAccess(
  tokensOwned: number,
  priceTon: number,
  tonRubRate: number
): boolean {
  return tokensOwned * priceTon * tonRubRate >= ACCESS_THRESHOLD_RUB;
}

// ── MISC ───────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
