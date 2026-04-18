// ─────────────────────────────────────────────
//  POKAYFU — Bonding Curve
//  price(sold) = BASE + SLOPE × sold
// ─────────────────────────────────────────────

const BASE_PRICE = 0.000001;   // TON
const SLOPE      = 0.0000000001; // TON per token

/**
 * Цена одного токена при данном количестве проданных
 */
export function getTokenPrice(tokensSold: number): number {
  return BASE_PRICE + SLOPE * tokensSold;
}

/**
 * Стоимость покупки N токенов при текущем supply
 * Интеграл bonding curve: area под графиком
 */
export function getBuyCost(tokensSold: number, buyAmount: number): number {
  // cost = BASE * n + SLOPE * (sold * n + n*(n-1)/2)
  const n = buyAmount;
  const s = tokensSold;
  return BASE_PRICE * n + SLOPE * (s * n + (n * (n - 1)) / 2);
}

/**
 * Выручка от продажи N токенов
 */
export function getSellReturn(tokensSold: number, sellAmount: number): number {
  const n = sellAmount;
  const s = tokensSold - sellAmount; // после продажи
  return BASE_PRICE * n + SLOPE * (s * n + (n * (n - 1)) / 2);
}

/**
 * Сколько токенов получишь за X TON
 */
export function getTokensForTon(tokensSold: number, tonAmount: number): number {
  // Решаем квадратное уравнение: SLOPE/2 * n^2 + (BASE + SLOPE*sold) * n - ton = 0
  const a = SLOPE / 2;
  const b = BASE_PRICE + SLOPE * tokensSold;
  const c = -tonAmount;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  return Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));
}

/**
 * Price impact в процентах
 */
export function getPriceImpact(tokensSold: number, buyAmount: number): number {
  const before = getTokenPrice(tokensSold);
  const after  = getTokenPrice(tokensSold + buyAmount);
  return ((after - before) / before) * 100;
}

/**
 * Оценка покупки для отображения пользователю
 */
export function estimateBuy(
  currentSupplySold: number,
  tonAmount: number,
  slippagePct: number = 0.5
) {
  const COMMISSION = 0.0125; // 1.25%
  const tonAfterFee = tonAmount * (1 - COMMISSION);
  const tokensOut = getTokensForTon(currentSupplySold, tonAfterFee);
  const pricePerToken = getTokenPrice(currentSupplySold);
  const priceImpact = getPriceImpact(currentSupplySold, tokensOut);

  return {
    tokensOut,
    pricePerToken,
    totalTon: tonAmount,
    priceImpact,
    slippage: slippagePct,
    minTokensOut: Math.floor(tokensOut * (1 - slippagePct / 100)),
  };
}

/**
 * Форматирование цены в TON (до 8 знаков)
 */
export function formatTon(value: number): string {
  return value.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Проверка доступа к треку (~15 рублей)
 */
export function checkTrackAccess(
  tokensOwned: number,
  currentPriceTon: number,
  tonRubRate: number,
  thresholdRub: number = 15
): boolean {
  const valueRub = tokensOwned * currentPriceTon * tonRubRate;
  return valueRub >= thresholdRub;
}
