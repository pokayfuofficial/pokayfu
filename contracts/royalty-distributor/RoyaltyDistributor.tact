// ─────────────────────────────────────────────────────────
//  POKAYFU — RoyaltyDistributor.tact
//  Автоматическое распределение Royalty Flow
//
//  При каждой сделке с Track Token:
//  → 0.25% поступает в этот контракт
//  → Распределяется между держателями Artist Token
//  → Каждый holder вызывает claim() для получения TON
//
//  Алгоритм: Accumulator Pattern (как в Uniswap V2)
//  accRoyaltyPerToken обновляется глобально,
//  каждый holder хранит свой lastAcc snapshot
// ─────────────────────────────────────────────────────────

import "@stdlib/deploy";
import "@stdlib/ownable";

// ── КОНСТАНТЫ ──────────────────────────────────────────
const PRECISION: Int = 1_000_000_000_000;   // Точность для расчётов
const MIN_CLAIM: Int = ton("0.001");          // Минимум для клейма

// ── СТРУКТУРЫ ──────────────────────────────────────────

struct HolderInfo {
    balance:         Int;   // Баланс Artist Token
    lastAccSnapshot: Int;   // Снапшот accRoyaltyPerToken на момент last update
    pendingReward:   Int;   // Накопленные необработанные роялти
}

// ── СООБЩЕНИЯ ──────────────────────────────────────────

message AddRoyalty {
    artistTokenAddress: Address;   // Какому Artist Token распределяем
}

message ClaimRoyaltyDist {}

message UpdateHolderBalance {
    holder:     Address;
    newBalance: Int as uint64;
}

message BatchUpdateHolders {
    artistTokenAddress: Address;
    // Обновляем топ-100 держателей (остальные получат при следующем claim)
}

message SetArtistToken {
    artistTokenAddress: Address;
}

// ── КОНТРАКТ ───────────────────────────────────────────

contract RoyaltyDistributor with Deployable, Ownable {

    owner:               Address;   // Платформа
    artistTokenAddress:  Address?;  // Связанный Artist Token контракт

    // Accumulator: накопленный royalty per token (scaled by PRECISION)
    accRoyaltyPerToken:  Int as coins;
    totalDistributed:    Int as coins;
    totalClaimed:        Int as coins;

    // Снапшоты держателей
    holders:             map<Address, HolderInfo>;
    holderCount:         Int as uint32;

    // Авторизованные источники роялти (TrackToken контракты)
    authorizedSources:   map<Address, Bool>;

    init(owner: Address) {
        self.owner              = owner;
        self.artistTokenAddress = null;
        self.accRoyaltyPerToken = 0;
        self.totalDistributed   = 0;
        self.totalClaimed       = 0;
        self.holders            = emptyMap();
        self.holderCount        = 0;
        self.authorizedSources  = emptyMap();
    }

    // ── НАСТРОЙКА ─────────────────────────────────────

    receive(msg: SetArtistToken) {
        self.requireOwner();
        self.artistTokenAddress = msg.artistTokenAddress;
    }

    receive(msg: AuthorizeSource) {
        self.requireOwner();
        self.authorizedSources.set(msg.sourceAddress, true);
    }

    receive(msg: RevokeSource) {
        self.requireOwner();
        self.authorizedSources.set(msg.sourceAddress, false);
    }

    // ── ПОЛУЧЕНИЕ ROYALTY ─────────────────────────────
    // Вызывается платформой при каждой сделке с Track Token
    // value сообщения = сумма royalty (0.25% от сделки)

    receive(msg: AddRoyalty) {
        require(
            sender() == self.owner ||
            self.authorizedSources.get(sender()) == true,
            "Unauthorized royalty source"
        );

        let royaltyAmount: Int = context().value - ton("0.01");  // Минус газ
        require(royaltyAmount > 0, "Zero royalty");

        // Обновляем глобальный аккумулятор
        // Если нет холдеров — роялти остаётся на контракте (безопасно)
        if (self.holderCount > 0) {
            // accRoyaltyPerToken += royalty * PRECISION / totalArtistTokens
            // Упрощение: делим поровну между зарегистрированными холдерами
            let perHolder: Int = royaltyAmount / self.holderCount;
            self.accRoyaltyPerToken = self.accRoyaltyPerToken + perHolder;
        }

        self.totalDistributed = self.totalDistributed + royaltyAmount;

        emit(RoyaltyReceived {
            from:   sender(),
            amount: royaltyAmount,
            newAcc: self.accRoyaltyPerToken
        }.toCell());
    }

    // ── КЛЕЙМ РОЯЛТИ ──────────────────────────────────

    receive(msg: ClaimRoyaltyDist) {
        let claimer: Address    = sender();
        let info: HolderInfo?  = self.holders.get(claimer);
        require(info != null, "Not a registered holder");

        let holderInfo: HolderInfo = info!!;
        let pending: Int = holderInfo.pendingReward +
            holderInfo.balance * (self.accRoyaltyPerToken - holderInfo.lastAccSnapshot) / PRECISION;

        require(pending >= MIN_CLAIM, "Below minimum claim amount");
        require(myBalance() >= pending + ton("0.05"), "Insufficient contract balance");

        // Обнуляем накопленное
        self.holders.set(claimer, HolderInfo {
            balance:         holderInfo.balance,
            lastAccSnapshot: self.accRoyaltyPerToken,
            pendingReward:   0
        });

        self.totalClaimed = self.totalClaimed + pending;

        send(SendParameters {
            to:    claimer,
            value: pending,
            mode:  SendIgnoreErrors,
            body:  "Royalty Flow claim".asComment()
        });

        emit(RoyaltyClaimedDist {
            claimer: claimer,
            amount:  pending
        }.toCell());
    }

    // ── ОБНОВЛЕНИЕ БАЛАНСОВ ХОЛДЕРОВ ──────────────────
    // Вызывается платформой когда меняется баланс Artist Token у холдера

    receive(msg: UpdateHolderBalance) {
        self.requireOwner();

        let addr: Address     = msg.holder;
        let existing: HolderInfo? = self.holders.get(addr);

        if (existing == null) {
            // Новый холдер
            if (msg.newBalance > 0) {
                self.holders.set(addr, HolderInfo {
                    balance:         msg.newBalance,
                    lastAccSnapshot: self.accRoyaltyPerToken,
                    pendingReward:   0
                });
                self.holderCount = self.holderCount + 1;
            }
        } else {
            let info: HolderInfo = existing!!;
            // Фиксируем накопленное перед обновлением баланса
            let earned: Int = info.balance *
                (self.accRoyaltyPerToken - info.lastAccSnapshot) / PRECISION;

            if (msg.newBalance == 0) {
                // Холдер вышел — сохраняем pending для клейма
                self.holders.set(addr, HolderInfo {
                    balance:         0,
                    lastAccSnapshot: self.accRoyaltyPerToken,
                    pendingReward:   info.pendingReward + earned
                });
                self.holderCount = self.holderCount - 1;
            } else {
                self.holders.set(addr, HolderInfo {
                    balance:         msg.newBalance,
                    lastAccSnapshot: self.accRoyaltyPerToken,
                    pendingReward:   info.pendingReward + earned
                });
            }
        }
    }

    // ── ГЕТТЕРЫ ───────────────────────────────────────

    get fun getPendingRoyalty(holder: Address): Int {
        let info: HolderInfo? = self.holders.get(holder);
        if (info == null) { return 0; }
        let h: HolderInfo = info!!;
        return h.pendingReward +
            h.balance * (self.accRoyaltyPerToken - h.lastAccSnapshot) / PRECISION;
    }

    get fun getHolderInfo(holder: Address): HolderInfo? {
        return self.holders.get(holder);
    }

    get fun getStats(): DistributorStats {
        return DistributorStats {
            accRoyaltyPerToken: self.accRoyaltyPerToken,
            totalDistributed:   self.totalDistributed,
            totalClaimed:       self.totalClaimed,
            holderCount:        self.holderCount,
            pendingInContract:  self.totalDistributed - self.totalClaimed
        };
    }

    get fun isRegisteredHolder(addr: Address): Bool {
        return self.holders.get(addr) != null;
    }
}

// ── ДОПОЛНИТЕЛЬНЫЕ СООБЩЕНИЯ ───────────────────────────
message AuthorizeSource { sourceAddress: Address; }
message RevokeSource    { sourceAddress: Address; }

// ── СОБЫТИЯ ────────────────────────────────────────────
message RoyaltyReceived {
    from:   Address;
    amount: Int as coins;
    newAcc: Int as coins;
}

message RoyaltyClaimedDist {
    claimer: Address;
    amount:  Int as coins;
}

// ── СТРУКТУРЫ ──────────────────────────────────────────
struct DistributorStats {
    accRoyaltyPerToken: Int;
    totalDistributed:   Int;
    totalClaimed:       Int;
    holderCount:        Int;
    pendingInContract:  Int;
}
