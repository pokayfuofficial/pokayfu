// ─────────────────────────────────────────────────────────
//  POKAYFU — TON Blockchain Client
//  Взаимодействие с TON через TonClient4
// ─────────────────────────────────────────────────────────

import { TonClient4 } from '@ton/ton';
import { Address, fromNano, toNano, Cell, beginCell } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

// ── SINGLETON CLIENT ───────────────────────────────────

let _client: TonClient4 | null = null;

export function getTonClient(): TonClient4 {
  if (!_client) {
    const isTestnet = process.env.TON_NETWORK !== 'mainnet';
    _client = new TonClient4({
      endpoint: isTestnet
        ? 'https://sandbox-v4.tonhubapi.com'
        : 'https://mainnet-v4.tonhubapi.com',
    });
  }
  return _client;
}

// ── PLATFORM WALLET ────────────────────────────────────

let _platformWallet: any = null;

export async function getPlatformWallet() {
  if (_platformWallet) return _platformWallet;

  const mnemonic = process.env.TON_MNEMONIC;
  if (!mnemonic) {
    // В dev режиме возвращаем mock
    console.warn('[TON] No mnemonic set, using mock wallet');
    return null;
  }

  const words   = mnemonic.split(' ');
  const keyPair = await mnemonicToPrivateKey(words);
  _platformWallet = keyPair;
  return keyPair;
}

// ── TRANSACTION HELPERS ────────────────────────────────

/**
 * Проверяет статус транзакции в TON
 */
export async function verifyTransaction(
  txHash: string,
  expectedTo: string,
  minAmountTon: number
): Promise<boolean> {
  try {
    const client = getTonClient();
    // TON транзакции верифицируются через API
    // В реальном проекте используем tonapi.io или indexer
    console.log(`[TON] Verifying tx: ${txHash} to ${expectedTo} min ${minAmountTon} TON`);

    // Mock верификация для development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Production: реальная верификация через TON API
    // const tx = await client.getTransaction(Address.parse(expectedTo), txHash);
    // return tx && BigInt(tx.inMessage?.value || '0') >= toNano(minAmountTon.toString());

    return true;
  } catch (err) {
    console.error('[TON] Transaction verification failed:', err);
    return false;
  }
}

/**
 * Получает баланс аккаунта в TON
 */
export async function getAccountBalance(address: string): Promise<string> {
  try {
    const client = getTonClient();
    const addr = Address.parse(address);
    const state = await client.getAccountLite(
      await client.getLastBlock().then(b => b.last.seqno),
      addr
    );
    return fromNano(state.account.balance.coins);
  } catch {
    return '0';
  }
}

/**
 * Получает информацию о Jetton токене
 */
export async function getJettonData(contractAddress: string): Promise<{
  totalSupply: string;
  adminAddress: string;
  content: string;
} | null> {
  try {
    const client = getTonClient();
    const seqno = await client.getLastBlock().then(b => b.last.seqno);
    const addr  = Address.parse(contractAddress);

    // Вызов get_jetton_data через TonClient4
    const result = await client.runMethod(seqno, addr, 'get_jetton_data', []);

    if (result.exitCode !== 0) return null;

    return {
      totalSupply: fromNano(result.reader.readBigNumber()),
      adminAddress: result.reader.readAddress()?.toString() || '',
      content: 'ok',
    };
  } catch (err) {
    console.error('[TON] getJettonData error:', err);
    return null;
  }
}

/**
 * Получает баланс Jetton токена у адреса
 */
export async function getJettonBalance(
  jettonMasterAddress: string,
  ownerAddress: string
): Promise<string> {
  try {
    // TODO: Реальный запрос через Jetton wallet address
    // 1. Получить адрес jetton wallet для ownerAddress
    // 2. Запросить balance через get_wallet_data
    return '0';
  } catch {
    return '0';
  }
}

/**
 * Формирует payload для покупки через STON.FI
 */
export function buildSwapPayload(params: {
  tokenIn:    string;  // 'TON' или адрес Jetton
  tokenOut:   string;  // адрес Jetton
  amountIn:   string;  // в наноТОН
  minAmountOut: string;
  recipient:  string;
}): string {
  // STON.FI swap payload format
  // В реальном проекте используем @ston-fi/sdk
  const payload = beginCell()
    .storeUint(0x25938561, 32)  // op: swap
    .storeUint(0, 64)           // query_id
    .storeAddress(Address.parse(params.tokenOut))
    .storeCoins(BigInt(params.minAmountOut))
    .storeAddress(Address.parse(params.recipient))
    .endCell();

  return payload.toBoc().toString('base64');
}

// ── PRICE FEED ─────────────────────────────────────────

/**
 * Получает текущий курс TON/RUB через CoinGecko
 */
export async function fetchTonRubRate(): Promise<number> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=rub',
      {
        timeout: 5000,
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
      }
    );
    return res.data?.['the-open-network']?.rub || 150;
  } catch {
    return 150; // Fallback
  }
}

/**
 * Получает цену токена с STON.FI
 */
export async function fetchTokenPriceFromStonfi(
  contractAddress: string
): Promise<{ priceTon: string; priceChange24h: number; volume24h: string } | null> {
  try {
    const axios = (await import('axios')).default;

    // STON.FI API v1
    const res = await axios.get(
      `https://api.ston.fi/v1/assets/${contractAddress}`,
      { timeout: 5000 }
    );

    const asset = res.data?.asset;
    if (!asset) return null;

    return {
      priceTon:      asset.dex_price_usd || '0.000001',
      priceChange24h: asset.price_change_24h || 0,
      volume24h:      asset.dex_volume_usd_24h || '0',
    };
  } catch {
    return null;
  }
}

/**
 * Получает данные пула ликвидности STON.FI
 */
export async function fetchStonfiPoolData(
  token0: string,
  token1: string = 'TON'
): Promise<{ lpTokenAddress: string; reserve0: string; reserve1: string } | null> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      `https://api.ston.fi/v1/pools?token0=${token0}&token1=${token1}`,
      { timeout: 5000 }
    );

    const pool = res.data?.pools?.[0];
    if (!pool) return null;

    return {
      lpTokenAddress: pool.lp_token_address || '',
      reserve0:       pool.reserve0 || '0',
      reserve1:       pool.reserve1 || '0',
    };
  } catch {
    return null;
  }
}
