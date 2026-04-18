import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { tracksApi, tokensApi } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { formatChange } from '@/utils/format';

const PRESETS = [
  { rub: 15,  ton: '0.1'  },
  { rub: 50,  ton: '0.3'  },
  { rub: 150, ton: '1.0'  },
  { rub: 500, ton: '3.2'  },
];

export function BuyScreen() {
  const { screenParams, goBack, showToast } = useUIStore();
  const trackId = screenParams.id;
  const [selected, setSelected] = useState(1);
  const [customRub, setCustomRub] = useState('');

  const { data: trackData } = useQuery({
    queryKey: ['track', trackId],
    queryFn:  () => tracksApi.getById(trackId).then(r => r.data.data),
    enabled:  !!trackId,
  });

  const amountRub  = customRub ? parseInt(customRub) : PRESETS[selected]?.rub || 50;
  const amountTon  = (amountRub / 150).toFixed(4);
  const tokensEst  = Math.round(amountRub / 0.002); // приближение

  const buyMutation = useMutation({
    mutationFn: () => tokensApi.buy(trackId, { amountTon, slippage: 0.5 }),
    onSuccess: () => showToast('💎 Токены куплены! Доступ к треку открыт.'),
    onError:   () => showToast('❌ Ошибка покупки. Попробуйте снова.', 'error'),
  });

  if (!trackData) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 pt-14 pb-4">
          <button className="w-9 h-9 rounded-[12px] bg-surface2 flex items-center justify-center cursor-pointer border-none"
                  onClick={goBack}>←</button>
        </div>
        <div className="flex flex-col gap-3 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[60px] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const track = trackData;
  const token = track.trackToken;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-5"
           style={{ background: 'linear-gradient(180deg, #12002A 0%, #0A0A12 100%)' }}>
        <div className="flex items-center gap-2.5 mb-5 cursor-pointer" onClick={goBack}>
          <button className="w-9 h-9 rounded-[12px] bg-surface2 border border-white/10
                             flex items-center justify-center text-[15px] border-none cursor-pointer">←</button>
          <span className="text-[12px] text-white/50 font-display">Назад</span>
        </div>
        <div className="font-display font-black text-[20px] text-white tracking-tight mb-1">
          Купить токен
        </div>
        <div className="text-[12px] text-white/50 mb-4">Инвестиция · не трата</div>

        {/* Track preview */}
        <div className="flex items-center gap-3.5 bg-surface border border-white/10 rounded-[18px] p-3.5">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center text-[26px] flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
            {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full rounded-[14px] object-cover" alt="" /> : '🎵'}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-[14px] text-white mb-0.5">{track.title}</div>
            <div className="text-[12px] text-white/50 mb-1.5">{track.artist?.user?.name}</div>
            <div className="pill-accent3">🔒 Ликвидность заблок.</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-white/35 mb-1">Цена</div>
            <div className="font-mono font-bold text-[15px] text-accent3">
              {token?.currentPriceTon || '—'}<br />
              <span className="text-[9px] text-white/35">TON</span>
            </div>
            {token && (
              <div className={`text-[10px] ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatChange(token.priceChange24h)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Amount selection */}
      <div className="px-4 mb-4">
        <div className="font-display font-bold text-[11px] text-white/50 uppercase tracking-wide mb-3">
          Выбери сумму
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              className="py-2.5 rounded-[12px] text-center cursor-pointer transition-all
                         active:scale-95 border"
              style={selected === i && !customRub
                ? { background: 'rgba(124,58,255,0.15)', borderColor: 'rgba(124,58,255,0.4)' }
                : { background: '#12121F', borderColor: 'rgba(255,255,255,0.1)' }
              }
              onClick={() => { setSelected(i); setCustomRub(''); }}
            >
              <div className={`font-display font-bold text-[12px] mb-0.5 ${selected === i && !customRub ? 'text-accent' : 'text-white'}`}>
                {p.rub} ₽
              </div>
              <div className={`text-[9px] ${selected === i && !customRub ? 'text-accent/60' : 'text-white/35'}`}>
                ~{p.ton} TON
              </div>
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="bg-surface border border-white/10 rounded-[14px] p-3.5 flex items-center gap-2.5 mb-4">
          <span className="text-[12px] text-white/50 flex-shrink-0">₽</span>
          <input
            type="number"
            value={customRub}
            onChange={e => setCustomRub(e.target.value)}
            placeholder="Своя сумма"
            className="flex-1 bg-transparent border-none outline-none font-display font-bold text-[20px] text-white placeholder:text-white/25"
          />
          <span className="text-[11px] text-white/35 font-mono flex-shrink-0">
            ≈ {amountTon} TON
          </span>
        </div>
      </div>

      {/* What you get */}
      <div className="mx-4 bg-surface border border-white/10 rounded-[18px] p-4 mb-4">
        <div className="font-display font-bold text-[10px] text-white/35 uppercase tracking-[1px] mb-3">
          Что ты получишь
        </div>
        {[
          { icon: '🎵', label: 'Токенов трека', value: `~${tokensEst.toLocaleString()} ${token?.ticker || 'токенов'}`, accent: true },
          { icon: '🎧', label: 'Полный доступ к треку', value: '✓ Навсегда', green: true },
          { icon: '💸', label: 'Комиссия платформы', value: '1.25%', accent: false },
          { icon: '🔓', label: 'Продать в любой момент', value: '✓ Да', green: true },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between mb-2.5 last:mb-0">
            <div className="flex items-center gap-2 text-[12px] text-white/50">
              <span className="text-[16px]">{row.icon}</span>
              {row.label}
            </div>
            <span className={`font-display font-bold text-[12px] ${row.accent ? 'text-accent3' : row.green ? 'text-green-400' : 'text-white'}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* TON Connect button */}
      <div className="mx-4 mb-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-[18px] flex items-center justify-center gap-2.5
                     cursor-pointer border-none font-display font-bold text-[13px] text-white"
          style={{ background: 'linear-gradient(135deg, #0098EA, #0070CC)', boxShadow: '0 8px 32px rgba(0,152,234,0.35)' }}
          onClick={() => buyMutation.mutate()}
          disabled={buyMutation.isPending}
        >
          <div className="w-7 h-7 bg-white/20 rounded-[8px] flex items-center justify-center font-bold text-[16px]">💎</div>
          {buyMutation.isPending ? 'Обработка...' : `Оплатить ${amountRub} ₽ через TON`}
        </motion.button>
        <div className="text-center text-[10px] text-white/35 mt-2">
          Wallet подключён через Telegram · Безопасно
        </div>
      </div>

      {/* Info */}
      <div className="mx-4 p-3.5 bg-surface border border-white/[0.06] rounded-[14px] mb-6">
        <div className="text-[10px] text-white/35 leading-relaxed">
          💡 Токены не тратятся при прослушивании. Ты можешь продать их в любой момент на STON.FI по рыночной цене. Чем популярнее трек — тем выше цена.
        </div>
      </div>
    </div>
  );
}
