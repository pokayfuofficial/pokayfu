import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { tracksApi, artistsApi } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';


const GENRES = [
  { id: 'HIP_HOP', label: '🎤 Hip-Hop' }, { id: 'ELECTRONIC', label: '⚡ Electronic' },
  { id: 'POP',     label: '🎹 Pop'      }, { id: 'RNB',        label: '🎷 R&B'        },
  { id: 'TRAP',    label: '🌊 Trap'     }, { id: 'INDIE',      label: '🎸 Indie'      },
  { id: 'ROCK',    label: '🤘 Rock'     }, { id: 'HOUSE',      label: '🏠 House'      },
  { id: 'OTHER',   label: '+ Другой'    },
];

const STEPS = ['Файл', 'Инфо', 'Жанр', 'Пуск'];

export function UploadScreen() {
  const { goBack, showToast, navigate } = useUIStore();
  const { user } = useAuthStore();
  const [step, setStep]     = useState(2); // 0-based, начинаем с шага жанра для демо
  const [title, setTitle]   = useState('Ночной Дрифт');
  const [genre, setGenre]   = useState('HIP_HOP');
  const [year, setYear]     = useState(new Date().getFullYear());
  const [lyrics, setLyrics] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      if (user?.role !== "ARTIST") { await artistsApi.register({ genres: [genre], txHash: "testnet-free" }); }
      return tracksApi.create({
      title,
      genre,
      year,
      lyrics: lyrics || undefined,
      audioUrl:    'https://cdn.pokayfu.com/audio/mock.mp3',
      durationSec: 240,
    });
    },
    onSuccess: (r) => {
      showToast(`🚀 Трек "${title}" публикуется! Токен создаётся на TON.`);
      setTimeout(() => navigate('track', { id: r.data.data.id }), 1500);
    },
    onError: () => showToast('❌ Ошибка создания трека', 'error'),
  });

  const ticker = `$${title.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 6) || 'TRK'}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center gap-2.5 mb-5 cursor-pointer" onClick={goBack}>
          <button className="w-9 h-9 rounded-[12px] bg-surface2 border border-white/10 flex items-center justify-center text-[15px] border-none cursor-pointer">←</button>
          <span className="text-[12px] text-white/50 font-display">Назад</span>
        </div>
        <div className="font-display font-black text-[22px] text-white tracking-tight mb-1">Новый трек</div>
        <div className="text-[12px] text-white/50">Токенизация на TON · Автоматически</div>
      </div>

      {/* Steps */}
      <div className="flex items-center px-4 mb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-[10px] flex-shrink-0"
                 style={i < step ? { background: '#00E5B0', color: '#0A1A14' }
                       : i === step ? { background: '#7C3AFF', color: 'white', boxShadow: '0 0 16px rgba(124,58,255,0.5)' }
                       : { background: '#222238', color: 'rgba(240,238,249,0.35)' }}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1" style={{ background: i < step ? '#00E5B0' : '#222238' }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between px-[6px] mb-5">
        {STEPS.map((s, i) => (
          <div key={i} className="text-center" style={{ width: 28 }}>
            <div className="text-[9px] font-display font-bold"
                 style={{ color: i === step ? '#7C3AFF' : i < step ? '#00E5B0' : 'rgba(240,238,249,0.35)' }}>
              {s}
            </div>
          </div>
        ))}
      </div>

      {/* Uploaded file (done) */}
      <div className="mx-4 mb-4 rounded-[20px] p-5 cursor-pointer"
           style={{ border: '2px solid #00E5B0', background: 'rgba(0,229,176,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] flex-shrink-0"
               style={{ background: 'rgba(0,229,176,0.12)', border: '1px solid rgba(0,229,176,0.2)' }}>🎵</div>
          <div className="flex-1">
            <div className="font-display font-bold text-[12px] text-white mb-0.5">nochnoy_drift.mp3</div>
            <div className="text-[10px] text-white/35 mb-1.5">8.4 МБ · 4:02 · 320 kbps</div>
            <div className="flex gap-1 items-end h-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}
                     className="w-[3px] rounded-sm"
                     style={{ background: '#00E5B0', height: `${Math.random() * 16 + 4}px`, animation: `wave 1.2s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mx-4 mb-4">
        <div className="flex items-center gap-1.5 font-display font-bold text-[10px] text-white/35 uppercase tracking-[1px] mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent2" />Название трека
        </div>
        <div className="bg-surface border border-accent/50 rounded-[14px] px-4 py-3.5 flex items-center gap-2.5"
             style={{ background: 'rgba(124,58,255,0.04)' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-white"
          />
          <div className="w-0.5 h-[18px] bg-accent animate-pulse" />
        </div>
      </div>

      {/* Genre */}
      <div className="mx-4 mb-4">
        <div className="flex items-center gap-1.5 font-display font-bold text-[10px] text-white/35 uppercase tracking-[1px] mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-accent2" />Жанр
        </div>
        <div className="grid grid-cols-3 gap-2">
          {GENRES.map(g => (
            <button
              key={g.id}
              className="py-2.5 px-2 rounded-[12px] text-center font-semibold text-[11px]
                         border cursor-pointer transition-all active:scale-95"
              style={genre === g.id
                ? { background: 'rgba(124,58,255,0.15)', borderColor: 'rgba(124,58,255,0.4)', color: '#7C3AFF' }
                : { background: '#12121F', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(240,238,249,0.6)' }
              }
              onClick={() => setGenre(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Year */}
      <div className="mx-4 mb-4">
        <div className="font-display font-bold text-[10px] text-white/35 uppercase tracking-[1px] mb-2">Год выпуска</div>
        <div className="bg-surface border border-white/10 rounded-[14px] px-4 py-3.5">
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="bg-transparent border-none outline-none text-[14px] text-white w-full"
          />
        </div>
      </div>

      {/* Token preview */}
      <div className="mx-4 mb-4 rounded-[20px] p-4 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #0D0020, #0A0A1A)', border: '1px solid rgba(124,58,255,0.2)' }}>
        <div className="absolute w-[150px] h-[150px] rounded-full top-[-50px] right-[-30px] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(124,58,255,0.15) 0%, transparent 70%)' }} />
        <div className="font-display font-bold text-[9px] text-white/35 uppercase tracking-[1.5px] mb-3">⚡ Превью токена</div>
        {[
          ['Тикер токена',    ticker,              'text-accent'],
          ['Эмиссия',         '1,000,000,000',     'text-white'],
          ['Начальная цена',  '~0.000001 TON',     'text-accent3'],
          ['Ликвидность',     '🔒 Навсегда',       'text-accent3'],
          ['Твои роялти',     '1% с каждой сделки','text-accent'],
        ].map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between mb-1.5 last:mb-0">
            <span className="text-[11px] text-white/35">{k}</span>
            <span className={`font-display font-bold text-[11px] ${c}`}>{v}</span>
          </div>
        ))}
      </div>

      {/* Fee notice */}
      <div className="mx-4 mb-4 p-3.5 bg-surface border border-white/[0.06] rounded-[14px] flex items-start gap-2.5">
        <span className="text-[18px] flex-shrink-0 mt-0.5">💎</span>
        <div className="text-[10px] text-white/35 leading-relaxed">
          Деплой токена требует <span className="text-white/60 font-semibold">~0.02 TON</span> на газ сети TON. Спишется через TON Connect.
        </div>
      </div>

      {/* Publish */}
      <div className="mx-4 mb-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-[18px] font-display font-bold text-[14px] text-white
                     cursor-pointer border-none relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7C3AFF, #9B5FFF)', boxShadow: '0 8px 32px rgba(124,58,255,0.4)' }}
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim()}
        >
          {createMutation.isPending ? '⏳ Публикуется...' : '🚀 Опубликовать и запустить токен'}
        </motion.button>
        <div className="text-center text-[10px] text-white/35 mt-2 leading-relaxed">
          Токен создан автоматически · Ликвидность заблокирована навсегда
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
