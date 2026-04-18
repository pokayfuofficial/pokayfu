// ─────────────────────────────────────────────────────────
//  POKAYFU — ArtistToken.tact
//  Токен артиста с механикой Royalty Flow
//  Эмиссия: 100 000 000 токенов
//  Распределение: 50% публично, 30% LP, 20% артисту
// ─────────────────────────────────────────────────────────

import "@stdlib/deploy";
import "@stdlib/ownable";

// ── КОНСТАНТЫ ──────────────────────────────────────────

const ARTIST_TOTAL_SUPPLY:    Int = 100_000_000;   // 100 млн токенов
const ARTIST_PUBLIC_SUPPLY:   Int = 50_000_000;    // 50% публичная продажа
const ARTIST_LP_SUPPLY:       Int = 30_000_000;    // 30% ликвидность
const ARTIST_CREATOR_SUPPLY:  Int = 20_000_000;    // 20% артисту

const ARTIST_BASE_PRICE:      Int = 10_000;         // 0.00001 TON (выше чем у трека)
const ARTIST_SLOPE:           Int = 500;
const ARTIST_COMMISSION_PCT:  Int = 200;             // 2% комиссия
const ARTIST_FEE_TO_ARTIST:   Int = 150;             // 1.5% артисту
const ARTIST_FEE_TO_PLATFORM: Int = 50;              // 0.5% платформе

// Royalty Flow: 0.25% от каждой сделки с Track Token
const ROYALTY_PCT:            Int = 25;              // из 10000

// ── СТРУКТУРЫ ──────────────────────────────────────────

struct ArtistMetadata {
    artistId:   String;
    name:       String;
    ticker:     String;   // напр. $KIRA
    genres:     String;
    country:    String;
    createdAt:  Int;
}

message BuyArtistTokens {
    minTokensOut: Int as uint64;
}

message SellArtistTokens {
    amount:    Int as uint64;
    minTonOut: Int as coins;
}

// Получение Royalty Flow от TrackToken контракта
message ReceiveRoyalty {
    trackTokenAddress: Address;
    period:            String;    // "daily" | "weekly"
}

// Холдер забирает свои роялти
message ClaimRoyalty {}

message DistributeRoyalty {
    totalAmount: Int as coins;
}

// ── КОНТРАКТ ───────────────────────────────────────────

contract ArtistToken with Deployable, Ownable {

    owner:            Address;
    artistWallet:     Address;
    platformWallet:   Address;
    metadata:         ArtistMetadata;

    totalSupply:      Int as uint64;
    soldSupply:       Int as uint64;
    lpLocked:         Bool;
    lpLockedAt:       Int as uint64;

    balances:         map<Address, Int>;
    pendingRoyalty:   map<Address, Int>;   // Накопленные роялти по адресу

    totalVolumeTon:   Int as coins;
    totalHolders:     Int as uint32;
    lastPriceNano:    Int as coins;
    totalRoyaltyPaid: Int as coins;

    // Авторизованные TrackToken контракты (которые могут присылать роялти)
    authorizedTracks: map<Address, Bool>;

    init(
        owner:          Address,
        artistWallet:   Address,
        platformWallet: Address,
        metadata:       ArtistMetadata
    ) {
        self.owner          = owner;
        self.artistWallet   = artistWallet;
        self.platformWallet = platformWallet;
        self.metadata       = metadata;

        self.totalSupply    = ARTIST_TOTAL_SUPPLY;
        self.soldSupply     = 0;
        self.lpLocked       = false;
        self.lpLockedAt     = 0;

        self.balances         = emptyMap();
        self.pendingRoyalty   = emptyMap();
        self.authorizedTracks = emptyMap();

        self.totalVolumeTon   = 0;
        self.totalHolders     = 0;
        self.lastPriceNano    = ARTIST_BASE_PRICE;
        self.totalRoyaltyPaid = 0;

        // Начисляем токены артисту сразу
        self.balances.set(artistWallet, ARTIST_CREATOR_SUPPLY);
        self.soldSupply   = ARTIST_CREATOR_SUPPLY;
        self.totalHolders = 1;
    }

    // ── АВТОРИЗАЦИЯ ТРЕК-ТОКЕНОВ ──────────────────────

    receive(msg: AuthorizeTrack) {
        self.requireOwner();
        self.authorizedTracks.set(msg.trackAddress, true);
    }

    receive(msg: RevokeTrack) {
        self.requireOwner();
        self.authorizedTracks.set(msg.trackAddress, false);
    }

    // ── ПОКУПКА ARTIST TOKEN ──────────────────────────

    receive(msg: BuyArtistTokens) {
        let tonIn: Int = context().value - GAS_RESERVE_ARTIST;
        require(tonIn >= MIN_ARTIST_BUY, "Too little TON");

        let commission: Int  = tonIn * ARTIST_COMMISSION_PCT / 10000;
        let artistFee: Int   = commission * ARTIST_FEE_TO_ARTIST / ARTIST_COMMISSION_PCT;
        let platFee: Int     = commission - artistFee;
        let tonForTokens: Int = tonIn - commission;

        let tokensOut: Int = self.calcArtistTokensForTon(tonForTokens);
        require(tokensOut > 0, "Zero output");
        require(tokensOut >= msg.minTokensOut, "Slippage exceeded");
        require(self.soldSupply + tokensOut <= ARTIST_PUBLIC_SUPPLY + ARTIST_CREATOR_SUPPLY, "Exceeds public supply");

        self.soldSupply     = self.soldSupply + tokensOut;
        self.lastPriceNano  = self.getArtistCurrentPrice();
        self.totalVolumeTon = self.totalVolumeTon + tonIn;

        let buyer: Address    = sender();
        let prevBal: Int      = self.balances.get(buyer) ?: 0;
        if (prevBal == 0) {
            self.totalHolders = self.totalHolders + 1;
        }
        self.balances.set(buyer, prevBal + tokensOut);

        // Комиссии
        send(SendParameters { to: self.artistWallet,   value: artistFee, mode: SendIgnoreErrors, body: "Artist fee".asComment() });
        send(SendParameters { to: self.platformWallet, value: platFee,   mode: SendIgnoreErrors, body: "Platform fee".asComment() });

        emit(ArtistTokensBought {
            buyer:     buyer,
            tonIn:     tonIn,
            tokensOut: tokensOut,
            newPrice:  self.lastPriceNano
        }.toCell());
    }

    // ── ПРОДАЖА ARTIST TOKEN ──────────────────────────

    receive(msg: SellArtistTokens) {
        let seller: Address = sender();
        let balance: Int    = self.balances.get(seller) ?: 0;
        require(balance >= msg.amount, "Insufficient balance");
        require(msg.amount > 0, "Zero amount");

        // Нельзя продавать токены артиста (создателя) — заблокированы
        // Для упрощения — пока разрешаем всем

        let tonOut: Int    = self.calcTonForArtistTokens(msg.amount);
        let commission: Int = tonOut * ARTIST_COMMISSION_PCT / 10000;
        let netOut: Int    = tonOut - commission;

        require(netOut >= msg.minTonOut, "Slippage exceeded");

        self.soldSupply     = self.soldSupply - msg.amount;
        self.lastPriceNano  = self.getArtistCurrentPrice();
        self.totalVolumeTon = self.totalVolumeTon + tonOut;

        let newBal: Int = balance - msg.amount;
        self.balances.set(seller, newBal);
        if (newBal == 0) {
            self.totalHolders = self.totalHolders - 1;
        }

        send(SendParameters { to: seller, value: netOut, mode: SendIgnoreErrors, body: "Sale proceeds".asComment() });

        let artistFee: Int = commission * ARTIST_FEE_TO_ARTIST / ARTIST_COMMISSION_PCT;
        let platFee: Int   = commission - artistFee;
        send(SendParameters { to: self.artistWallet,   value: artistFee, mode: SendIgnoreErrors, body: "Fee".asComment() });
        send(SendParameters { to: self.platformWallet, value: platFee,   mode: SendIgnoreErrors, body: "Fee".asComment() });
    }

    // ── ROYALTY FLOW ──────────────────────────────────
    // Вызывается платформой когда TrackToken получает комиссию
    // Распределяет 0.25% от сделки трека между держателями Artist Token

    receive(msg: DistributeRoyalty) {
        // Только платформа или авторизованные трек-токены могут распределять
        require(
            sender() == self.owner ||
            self.authorizedTracks.get(sender()) == true,
            "Unauthorized"
        );

        let totalAmount: Int = msg.totalAmount;
        require(totalAmount > 0, "Zero royalty");

        // Распределяем пропорционально долям держателей
        // В реальном контракте нужен снапшот или off-chain расчёт
        // Здесь упрощённая версия: накапливаем на контракте
        // и каждый holder получает свою долю при claim

        // Обновляем accumulated royalty per token
        // accRoyaltyPerToken += totalAmount / totalHolders (упрощение)
        // В продакшне: ERC20-стайл accumulator

        self.totalRoyaltyPaid = self.totalRoyaltyPaid + totalAmount;

        emit(RoyaltyDistributed {
            amount:   totalAmount,
            from:     sender(),
            holders:  self.totalHolders
        }.toCell());
    }

    // Холдер забирает свои накопленные роялти
    receive(msg: ClaimRoyalty) {
        let claimer: Address = sender();
        let pending: Int     = self.pendingRoyalty.get(claimer) ?: 0;
        require(pending > 0, "No pending royalty");
        require(myBalance() >= pending + GAS_RESERVE_ARTIST, "Insufficient contract balance");

        self.pendingRoyalty.set(claimer, 0);

        send(SendParameters {
            to:   claimer,
            value: pending,
            mode:  SendIgnoreErrors,
            body:  "Royalty claim".asComment()
        });

        emit(RoyaltyClaimed {
            claimer: claimer,
            amount:  pending
        }.toCell());
    }

    // ── LP БЛОКИРОВКА ─────────────────────────────────

    receive("lock_artist_lp") {
        self.requireOwner();
        require(!self.lpLocked, "Already locked");
        self.lpLocked   = true;
        self.lpLockedAt = now();

        emit(ArtistLPLocked {
            lockedAt: self.lpLockedAt
        }.toCell());
    }

    // ── ГЕТТЕРЫ ───────────────────────────────────────

    get fun getArtistCurrentPrice(): Int {
        return ARTIST_BASE_PRICE + (ARTIST_SLOPE * self.soldSupply / 1_000_000);
    }

    get fun calcArtistTokensForTon(tonAmount: Int): Int {
        let price: Int = self.getArtistCurrentPrice();
        if (price == 0) { return 0; }
        return tonAmount * 1_000_000 / price;
    }

    get fun calcTonForArtistTokens(tokenAmount: Int): Int {
        let avgSold: Int  = self.soldSupply - tokenAmount / 2;
        let avgPrice: Int = ARTIST_BASE_PRICE + (ARTIST_SLOPE * avgSold / 1_000_000);
        return tokenAmount * avgPrice / 1_000_000;
    }

    get fun balanceOf(addr: Address): Int {
        return self.balances.get(addr) ?: 0;
    }

    get fun pendingRoyaltyOf(addr: Address): Int {
        return self.pendingRoyalty.get(addr) ?: 0;
    }

    get fun getArtistInfo(): ArtistTokenInfo {
        return ArtistTokenInfo {
            ticker:           self.metadata.ticker,
            artistId:         self.metadata.artistId,
            name:             self.metadata.name,
            totalSupply:      self.totalSupply,
            soldSupply:       self.soldSupply,
            currentPrice:     self.getArtistCurrentPrice(),
            totalVolume:      self.totalVolumeTon,
            totalHolders:     self.totalHolders,
            lpLocked:         self.lpLocked,
            lpLockedAt:       self.lpLockedAt,
            totalRoyaltyPaid: self.totalRoyaltyPaid
        };
    }
}

// ── КОНСТАНТЫ ──────────────────────────────────────────
const GAS_RESERVE_ARTIST: Int = ton("0.05");
const MIN_ARTIST_BUY:     Int = ton("0.01");

// ── СООБЩЕНИЯ ──────────────────────────────────────────
message AuthorizeTrack { trackAddress: Address; }
message RevokeTrack    { trackAddress: Address; }

message ArtistTokensBought {
    buyer:     Address;
    tonIn:     Int as coins;
    tokensOut: Int as uint64;
    newPrice:  Int as coins;
}

message RoyaltyDistributed {
    amount:  Int as coins;
    from:    Address;
    holders: Int as uint32;
}

message RoyaltyClaimed {
    claimer: Address;
    amount:  Int as coins;
}

message ArtistLPLocked {
    lockedAt: Int as uint64;
}

// ── СТРУКТУРЫ ВОЗВРАТА ─────────────────────────────────
struct ArtistTokenInfo {
    ticker:           String;
    artistId:         String;
    name:             String;
    totalSupply:      Int;
    soldSupply:       Int;
    currentPrice:     Int;
    totalVolume:      Int;
    totalHolders:     Int;
    lpLocked:         Bool;
    lpLockedAt:       Int;
    totalRoyaltyPaid: Int;
}
