// ─────────────────────────────────────────────────────────
//  POKAYFU — TrackToken.tact
//  TEP-74 Jetton стандарт с bonding curve ценообразованием
//  Эмиссия: 1 000 000 000 токенов
// ─────────────────────────────────────────────────────────

import "@stdlib/deploy";
import "@stdlib/ownable";

// ── СТРУКТУРЫ СООБЩЕНИЙ ────────────────────────────────

struct TrackMetadata {
    trackId:    String;   // ID трека в БД Pokayfu
    artistId:   String;   // ID артиста
    title:      String;   // Название трека
    ticker:     String;   // Тикер токена (напр. $NDRIFT)
    genre:      String;   // Жанр
    createdAt:  Int;      // Unix timestamp создания
}

// Сообщения
message BuyTokens {
    minTokensOut: Int as uint64;   // Минимум токенов (slippage защита)
    referrer:     Address?;        // Реферер (опционально)
}

message SellTokens {
    amount:     Int as uint64;     // Количество токенов для продажи
    minTonOut:  Int as coins;      // Минимум TON обратно
}

message TransferNotification {
    queryId:  Int as uint64;
    amount:   Int as uint64;
    from:     Address;
    payload:  Slice as remaining;
}

message UpdateMetadata {
    newTitle: String;
}

message WithdrawFees {
    amount: Int as coins;
}

// ── КОНСТАНТЫ ──────────────────────────────────────────

const TOTAL_SUPPLY:   Int = 1_000_000_000;   // 1 млрд токенов
const BASE_PRICE:     Int = 1_000;           // 0.000001 TON (в наноTON / 1000)
const SLOPE:          Int = 100;             // Наклон bonding curve
const COMMISSION_PCT: Int = 125;             // 1.25% (из 10000)
const ARTIST_PCT:     Int = 100;             // 1% артисту
const PLATFORM_PCT:   Int = 25;             // 0.25% платформе
const MIN_TON_BUY:    Int = ton("0.005");    // Минимальная покупка
const GAS_RESERVE:    Int = ton("0.05");     // Резерв на газ

// ── КОНТРАКТ ───────────────────────────────────────────

contract TrackToken with Deployable, Ownable {

    // Хранилище
    owner:            Address;          // Платформа Pokayfu
    artistWallet:     Address;          // Кошелёк артиста
    platformWallet:   Address;          // Кошелёк платформы
    metadata:         TrackMetadata;

    totalSupply:      Int as uint64;    // 1 000 000 000
    soldSupply:       Int as uint64;    // Сколько уже продано
    lpLocked:         Bool;             // LP заблокирован?
    lpLockedAt:       Int as uint64;    // Timestamp блокировки
    lpTxHash:         String;           // Hash транзакции блокировки

    // Балансы держателей
    balances:         map<Address, Int>;  // address → amount

    // Статистика
    totalVolumeTon:   Int as coins;
    totalHolders:     Int as uint32;
    lastPriceNano:    Int as coins;     // Последняя цена в nanotон

    init(
        owner:          Address,
        artistWallet:   Address,
        platformWallet: Address,
        metadata:       TrackMetadata
    ) {
        self.owner          = owner;
        self.artistWallet   = artistWallet;
        self.platformWallet = platformWallet;
        self.metadata       = metadata;

        self.totalSupply    = TOTAL_SUPPLY;
        self.soldSupply     = 0;
        self.lpLocked       = false;
        self.lpLockedAt     = 0;
        self.lpTxHash       = "";

        self.balances       = emptyMap();
        self.totalVolumeTon = 0;
        self.totalHolders   = 0;
        self.lastPriceNano  = BASE_PRICE;
    }

    // ── ПОКУПКА ТОКЕНОВ ──────────────────────────────

    receive(msg: BuyTokens) {
        let tonIn: Int = context().value - GAS_RESERVE;
        require(tonIn >= MIN_TON_BUY, "Too little TON sent");

        // Комиссия
        let commission: Int = tonIn * COMMISSION_PCT / 10000;
        let artistFee: Int  = commission * ARTIST_PCT / COMMISSION_PCT;
        let platFee: Int    = commission - artistFee;
        let tonForTokens: Int = tonIn - commission;

        // Сколько токенов выдать по bonding curve
        let tokensOut: Int = self.calcTokensForTon(tonForTokens);
        require(tokensOut > 0, "Zero tokens output");
        require(tokensOut >= msg.minTokensOut, "Slippage exceeded");
        require(self.soldSupply + tokensOut <= self.totalSupply, "Exceeds total supply");

        // Обновляем состояние
        self.soldSupply = self.soldSupply + tokensOut;
        self.lastPriceNano = self.getCurrentPrice();
        self.totalVolumeTon = self.totalVolumeTon + tonIn;

        // Обновляем баланс покупателя
        let buyer: Address = sender();
        let prevBalance: Int = self.balances.get(buyer) ?: 0;
        if (prevBalance == 0) {
            self.totalHolders = self.totalHolders + 1;
        }
        self.balances.set(buyer, prevBalance + tokensOut);

        // Отправляем комиссии
        send(SendParameters {
            to:     self.artistWallet,
            value:  artistFee,
            mode:   SendIgnoreErrors,
            body:   "Royalty from track token sale".asComment()
        });

        send(SendParameters {
            to:     self.platformWallet,
            value:  platFee,
            mode:   SendIgnoreErrors,
            body:   "Platform fee".asComment()
        });

        // Уведомляем о покупке (для индексера)
        emit(TokensBought {
            buyer:     buyer,
            tonIn:     tonIn,
            tokensOut: tokensOut,
            newPrice:  self.lastPriceNano,
            soldSupply: self.soldSupply
        }.toCell());
    }

    // ── ПРОДАЖА ТОКЕНОВ ──────────────────────────────

    receive(msg: SellTokens) {
        let seller: Address = sender();
        let balance: Int = self.balances.get(seller) ?: 0;
        require(balance >= msg.amount, "Insufficient token balance");
        require(msg.amount > 0, "Zero sell amount");

        // Сколько TON вернуть
        let tonOut: Int = self.calcTonForTokens(msg.amount);
        let commission: Int = tonOut * COMMISSION_PCT / 10000;
        let artistFee: Int  = commission * ARTIST_PCT / COMMISSION_PCT;
        let platFee: Int    = commission - artistFee;
        let netTonOut: Int  = tonOut - commission;

        require(netTonOut >= msg.minTonOut, "Slippage exceeded");
        require(myBalance() >= netTonOut + GAS_RESERVE, "Insufficient contract balance");

        // Обновляем состояние
        self.soldSupply = self.soldSupply - msg.amount;
        self.lastPriceNano = self.getCurrentPrice();
        self.totalVolumeTon = self.totalVolumeTon + tonOut;

        // Обновляем баланс
        let newBalance: Int = balance - msg.amount;
        if (newBalance == 0) {
            self.balances.set(seller, 0);
            self.totalHolders = self.totalHolders - 1;
        } else {
            self.balances.set(seller, newBalance);
        }

        // Отправляем TON продавцу
        send(SendParameters {
            to:    seller,
            value: netTonOut,
            mode:  SendIgnoreErrors,
            body:  "Token sale proceeds".asComment()
        });

        // Комиссии
        send(SendParameters { to: self.artistWallet,   value: artistFee, mode: SendIgnoreErrors, body: "Royalty".asComment() });
        send(SendParameters { to: self.platformWallet, value: platFee,   mode: SendIgnoreErrors, body: "Fee".asComment() });

        emit(TokensSold {
            seller:     seller,
            tokensIn:   msg.amount,
            tonOut:     netTonOut,
            newPrice:   self.lastPriceNano,
            soldSupply: self.soldSupply
        }.toCell());
    }

    // ── БЛОКИРОВКА LP ─────────────────────────────────

    receive("lock_lp") {
        self.requireOwner();
        require(!self.lpLocked, "LP already locked");

        self.lpLocked   = true;
        self.lpLockedAt = now();

        emit(LiquidityLocked {
            lockedAt:  self.lpLockedAt,
            lockedBy:  sender()
        }.toCell());
    }

    // Обновление hash транзакции блокировки LP
    receive(msg: UpdateLpTxHash) {
        self.requireOwner();
        self.lpTxHash = msg.txHash;
    }

    // ── ГЕТТЕРЫ ───────────────────────────────────────

    // Текущая цена токена в наноTON
    get fun getCurrentPrice(): Int {
        // price = BASE_PRICE + SLOPE * soldSupply / 1_000_000
        return BASE_PRICE + (SLOPE * self.soldSupply / 1_000_000);
    }

    // Расчёт токенов за TON (bonding curve интеграл)
    get fun calcTokensForTon(tonAmount: Int): Int {
        // Упрощённый расчёт: итеративный метод
        // В продакшне использовать точную формулу квадратного уравнения
        let price: Int = self.getCurrentPrice();
        if (price == 0) { return 0; }
        return tonAmount * 1_000_000 / price;
    }

    // Расчёт TON за токены
    get fun calcTonForTokens(tokenAmount: Int): Int {
        let avgSold: Int = self.soldSupply - tokenAmount / 2;
        let avgPrice: Int = BASE_PRICE + (SLOPE * avgSold / 1_000_000);
        return tokenAmount * avgPrice / 1_000_000;
    }

    // Баланс токенов адреса
    get fun balanceOf(owner: Address): Int {
        return self.balances.get(owner) ?: 0;
    }

    // Полная информация о токене
    get fun getTokenInfo(): TokenInfo {
        return TokenInfo {
            ticker:       self.metadata.ticker,
            trackId:      self.metadata.trackId,
            artistId:     self.metadata.artistId,
            totalSupply:  self.totalSupply,
            soldSupply:   self.soldSupply,
            currentPrice: self.getCurrentPrice(),
            totalVolume:  self.totalVolumeTon,
            totalHolders: self.totalHolders,
            lpLocked:     self.lpLocked,
            lpLockedAt:   self.lpLockedAt
        };
    }

    // Проверка доступа к треку (~15 руб в наноTON)
    // tonRubRate передаётся как целое число (напр. 150 для 150 руб/TON)
    get fun hasAccess(user: Address, tonRubRate: Int): Bool {
        let tokens: Int = self.balances.get(user) ?: 0;
        let price: Int  = self.getCurrentPrice();
        // valueRub = tokens * price * tonRubRate / 1_000_000 / 1_000_000_000
        // Упрощение для целочисленной арифметики:
        let valueNano: Int = tokens * price / 1_000_000;   // в наноTON
        let valueRub: Int  = valueNano * tonRubRate / 1_000_000_000;
        return valueRub >= 15;
    }
}

// ── СОБЫТИЯ (для индексера) ───────────────────

message TokensBought {
    buyer:      Address;
    tonIn:      Int as coins;
    tokensOut:  Int as uint64;
    newPrice:   Int as coins;
    soldSupply: Int as uint64;
}

message TokensSold {
    seller:     Address;
    tokensIn:   Int as uint64;
    tonOut:     Int as coins;
    newPrice:   Int as coins;
    soldSupply: Int as uint64;
}

message LiquidityLocked {
    lockedAt: Int as uint64;
    lockedBy: Address;
}

message UpdateLpTxHash {
    txHash: String;
}

// ── СТРУКТУРЫ ВОЗВРАТА ─────────────────────────

struct TokenInfo {
    ticker:       String;
    trackId:      String;
    artistId:     String;
    totalSupply:  Int;
    soldSupply:   Int;
    currentPrice: Int;
    totalVolume:  Int;
    totalHolders: Int;
    lpLocked:     Bool;
    lpLockedAt:   Int;
}
