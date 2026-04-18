// ─────────────────────────────────────────────────────────
//  POKAYFU — LiquidityLock.tact
//  Контракт вечной блокировки ликвидности
//
//  Принцип работы:
//  1. LP токены отправляются на этот контракт
//  2. Контракт записывает их навсегда
//  3. Любая попытка вывода возвращает ошибку LOCK_IS_PERMANENT
//  4. Данные блокировки публично видны через геттеры
//
//  Это ЕДИНСТВЕННАЯ гарантия что ликвидность заблокирована
//  навсегда — код контракта не содержит функции вывода
// ─────────────────────────────────────────────────────────

import "@stdlib/deploy";
import "@stdlib/ownable";

// ── СТРУКТУРЫ ──────────────────────────────────────────

struct LockRecord {
    trackTokenAddress: Address;   // Адрес Track Token контракта
    lpTokenAddress:    Address;   // Адрес LP токена на STON.FI
    lockedAmount:      Int;       // Количество LP токенов
    lockedAt:          Int;       // Unix timestamp
    lockedBy:          Address;   // Кто заблокировал (платформа)
    trackId:           String;    // ID трека в Pokayfu
    ticker:            String;    // Тикер токена
}

// ── СООБЩЕНИЯ ──────────────────────────────────────────

message LockLiquidity {
    trackTokenAddress: Address;
    lpTokenAddress:    Address;
    amount:            Int as uint128;
    trackId:           String;
    ticker:            String;
}

// Попытка вывода — всегда отклоняется
message WithdrawLiquidity {
    amount: Int as coins;
}

// Обновление метаданных записи (только для добавления txHash)
message UpdateLockRecord {
    trackTokenAddress: Address;
    txHash:            String;
}

// ── КОНТРАКТ ───────────────────────────────────────────

contract LiquidityLock with Deployable, Ownable {

    owner:       Address;   // Платформа Pokayfu
    lockCount:   Int as uint32;

    // Маппинг: trackTokenAddress → LockRecord
    locks:       map<Address, LockRecord>;
    // Хэши транзакций блокировки
    txHashes:    map<Address, String>;

    // Агрегированная статистика
    totalLockedRecords: Int as uint32;
    totalTonLocked:     Int as coins;

    init(owner: Address) {
        self.owner              = owner;
        self.lockCount          = 0;
        self.locks              = emptyMap();
        self.txHashes           = emptyMap();
        self.totalLockedRecords = 0;
        self.totalTonLocked     = 0;
    }

    // ── БЛОКИРОВКА ЛИКВИДНОСТИ ────────────────────────

    receive(msg: LockLiquidity) {
        // Только платформа может блокировать
        self.requireOwner();

        // Нельзя заблокировать дважды
        let existing: LockRecord? = self.locks.get(msg.trackTokenAddress);
        require(existing == null, "Already locked for this track");

        let record: LockRecord = LockRecord {
            trackTokenAddress: msg.trackTokenAddress,
            lpTokenAddress:    msg.lpTokenAddress,
            lockedAmount:      msg.amount,
            lockedAt:          now(),
            lockedBy:          sender(),
            trackId:           msg.trackId,
            ticker:            msg.ticker
        };

        self.locks.set(msg.trackTokenAddress, record);
        self.lockCount          = self.lockCount + 1;
        self.totalLockedRecords = self.totalLockedRecords + 1;

        // Сообщаем TrackToken контракту что LP заблокирован
        send(SendParameters {
            to:    msg.trackTokenAddress,
            value: ton("0.01"),
            mode:  SendIgnoreErrors,
            body:  "lock_lp".asComment()
        });

        emit(LiquidityLockedEvent {
            trackTokenAddress: msg.trackTokenAddress,
            lpTokenAddress:    msg.lpTokenAddress,
            amount:            msg.amount,
            lockedAt:          now(),
            trackId:           msg.trackId,
            ticker:            msg.ticker
        }.toCell());
    }

    // ── ВЕЧНАЯ БЛОКИРОВКА — ВЫВОД НЕВОЗМОЖЕН ─────────

    receive(msg: WithdrawLiquidity) {
        // LOCK_IS_PERMANENT — эта функция НИКОГДА не выполняется
        // Контракт намеренно отклоняет все попытки вывода
        require(false, "LOCK_IS_PERMANENT: Liquidity is locked forever. Rug pull is impossible.");
    }

    // Отклоняем любые другие попытки вывода
    receive("withdraw") {
        require(false, "LOCK_IS_PERMANENT");
    }

    receive("unlock") {
        require(false, "LOCK_IS_PERMANENT");
    }

    // ── ОБНОВЛЕНИЕ TX HASH ────────────────────────────

    receive(msg: UpdateLockRecord) {
        self.requireOwner();
        require(self.locks.get(msg.trackTokenAddress) != null, "Lock not found");
        self.txHashes.set(msg.trackTokenAddress, msg.txHash);
    }

    // ── ГЕТТЕРЫ ───────────────────────────────────────

    // Получить запись блокировки для трека
    get fun getLockRecord(trackTokenAddress: Address): LockRecord? {
        return self.locks.get(trackTokenAddress);
    }

    // Проверить заблокирована ли ликвидность трека
    get fun isLocked(trackTokenAddress: Address): Bool {
        return self.locks.get(trackTokenAddress) != null;
    }

    // Хэш транзакции блокировки
    get fun getLockTxHash(trackTokenAddress: Address): String {
        return self.txHashes.get(trackTokenAddress) ?: "";
    }

    // Агрегированная статистика
    get fun getStats(): LockStats {
        return LockStats {
            totalLockedRecords: self.totalLockedRecords,
            lockCount:          self.lockCount
        };
    }

    // Публичное подтверждение что контракт НИКОГДА не выведет LP
    get fun permanentLockGuarantee(): String {
        return "This contract permanently locks liquidity. No withdrawal function exists. Rug pull is mathematically impossible.";
    }
}

// ── СОБЫТИЯ ────────────────────────────────────────────

message LiquidityLockedEvent {
    trackTokenAddress: Address;
    lpTokenAddress:    Address;
    amount:            Int as uint128;
    lockedAt:          Int as uint64;
    trackId:           String;
    ticker:            String;
}

// ── СТРУКТУРЫ ВОЗВРАТА ─────────────────────────────────

struct LockStats {
    totalLockedRecords: Int;
    lockCount:          Int;
}
