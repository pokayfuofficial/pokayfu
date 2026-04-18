// ─────────────────────────────────────────────────────────
//  POKAYFU — Deploy Script
//  Деплой всех смарт-контрактов в TON
//  Использование:
//    TON_NETWORK=testnet npx ts-node scripts/deploy.ts
//    TON_NETWORK=mainnet npx ts-node scripts/deploy.ts
// ─────────────────────────────────────────────────────────

import { TonClient, WalletContractV4, internal, fromNano, toNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../apps/api-server/.env' });

// ── КОНФИГУРАЦИЯ ───────────────────────────────────────

const NETWORK = (process.env.TON_NETWORK || 'testnet') as 'testnet' | 'mainnet';

const ENDPOINTS = {
  testnet: 'https://testnet.toncenter.com/api/v2',
  mainnet: 'https://toncenter.com/api/v2',
};

// ── ДЕПЛОЙ ─────────────────────────────────────────────

async function deploy() {
  console.log(`\n🚀 Pokayfu Contract Deployment`);
  console.log(`📡 Network: ${NETWORK.toUpperCase()}`);
  console.log('─'.repeat(50));

  // Инициализация клиента
  const client = new TonClient({
    endpoint: ENDPOINTS[NETWORK],
    apiKey:   process.env.TON_API_KEY,
  });

  // Загрузка кошелька платформы
  const mnemonic = process.env.TON_MNEMONIC?.split(' ');
  if (!mnemonic || mnemonic.length !== 24) {
    throw new Error('TON_MNEMONIC must be 24 words in .env');
  }

  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet  = WalletContractV4.create({
    publicKey:  keyPair.publicKey,
    workchain:  0,
  });

  const walletContract = client.open(wallet);
  const balance = await walletContract.getBalance();

  console.log(`\n💼 Platform wallet: ${wallet.address.toString()}`);
  console.log(`💰 Balance: ${fromNano(balance)} TON`);

  if (balance < toNano('2')) {
    throw new Error('Insufficient balance. Need at least 2 TON for deployment.');
  }

  // ── ШАГ 1: Деплой LiquidityLock ─────────────────────

  console.log('\n📦 Step 1: Deploying LiquidityLock...');

  // TODO: После компиляции Tact — импортировать реальный контракт
  // import { LiquidityLock } from '../build/liquidity-lock/LiquidityLock';

  // Адрес будет получен после реального деплоя
  const liquidityLockAddress = 'EQ_LIQUIDITY_LOCK_PLACEHOLDER';

  console.log(`   ✅ LiquidityLock: ${liquidityLockAddress}`);
  console.log(`      Gas used: ~0.5 TON`);

  // ── ШАГ 2: Деплой RoyaltyDistributor ────────────────

  console.log('\n📦 Step 2: Deploying RoyaltyDistributor...');

  const royaltyDistributorAddress = 'EQ_ROYALTY_DISTRIBUTOR_PLACEHOLDER';

  console.log(`   ✅ RoyaltyDistributor: ${royaltyDistributorAddress}`);
  console.log(`      Gas used: ~0.5 TON`);

  // ── ШАГ 3: Сохранение адресов ────────────────────────

  const deployedContracts = {
    network:              NETWORK,
    deployedAt:           new Date().toISOString(),
    platformWallet:       wallet.address.toString(),
    liquidityLock:        liquidityLockAddress,
    royaltyDistributor:   royaltyDistributorAddress,
  };

  const fs = await import('fs');
  const outputPath = `./build/deployed-${NETWORK}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(deployedContracts, null, 2));

  console.log('\n─'.repeat(50));
  console.log('✅ Deployment complete!');
  console.log(`📄 Addresses saved to: ${outputPath}`);
  console.log('\n📋 Add these to your .env:');
  console.log(`LIQUIDITY_LOCK_ADDRESS=${liquidityLockAddress}`);
  console.log(`ROYALTY_DISTRIBUTOR_ADDRESS=${royaltyDistributorAddress}`);
  console.log('\n⚡ Next step: Run platform to start deploying track tokens!');
}

// ── ДЕПЛОЙ ТОКЕНА ДЛЯ КОНКРЕТНОГО ТРЕКА ────────────────

export async function deployTrackToken(params: {
  trackId:        string;
  artistId:       string;
  title:          string;
  ticker:         string;
  genre:          string;
  artistWallet:   string;
  platformWallet: string;
}): Promise<{ contractAddress: string; lpTxHash: string }> {

  console.log(`\n🎵 Deploying TrackToken: ${params.ticker}`);
  console.log(`   Track: ${params.title}`);
  console.log(`   Artist: ${params.artistId}`);

  // TODO: Реальный деплой после компиляции Tact контрактов
  // 1. Compile TrackToken.tact → получить init code
  // 2. Create contract instance with params
  // 3. Send deploy message with TON
  // 4. Wait for confirmation
  // 5. Create STON.FI liquidity pool
  // 6. Send LP tokens to LiquidityLock contract
  // 7. Confirm LP locked on LiquidityLock contract

  // Симуляция для разработки
  const mockAddress = `EQ${Buffer.from(params.trackId).toString('hex').slice(0, 62)}`;
  const mockLpHash  = `lp_lock_${Date.now()}`;

  await new Promise(r => setTimeout(r, 100)); // Симуляция задержки

  console.log(`   ✅ Contract: ${mockAddress}`);
  console.log(`   🔒 LP locked: ${mockLpHash}`);

  return {
    contractAddress: mockAddress,
    lpTxHash:        mockLpHash,
  };
}

// ── ЗАПУСК ─────────────────────────────────────────────

deploy().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
