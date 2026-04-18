import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { chartsApi } from '@/api/client';
import { TrackCard } from '@/components/track/TrackCard';
import { useUIStore } from '@/stores/uiStore';

const CHART_TABS = [
  { id: 'hot',     label: '🔥 Горячие'  },
  { id: 'rising',  label: '📈 Растущие' },
  { id: 'holders', label: '💎 Холдеры'  },
  { id: 'new',     label: '⚡ Новинки'  },
  { id: 'volume',  label: '💰 Объём'    },
  { id: 'genre',   label: '🎵 Жанры'    },
];

const REGIONS = [
  { id: 'RU',    label: '🇷🇺 Россия' },
  { id: 'CIS',   label: '🌍 СНГ'    },
  { id: 'WORLD', label: '🌐 Мир'    },
];

const PERIODS = [
  { id: '24h', label: '24ч'   },
  { id: '7d',  label: '7 дней'},
  { id: '30d', label: '30 дней'},
];

const GENRES = [
  { id: 'HIP_HOP',    icon: '🎤', label: 'Hip-Hop'    },
  { id: 'ELECTRONIC', icon: '⚡', label: 'Electronic'  },
  { id: 'POP',        icon: '🎹', label: 'Pop'         },
  { id: 'RNB',        icon: '🎷', label: 'R&B'         },
  { id: 'TRAP',       icon: '🔊', label: 'Trap'        },
  { id: 'INDIE',      icon: '🎸', label: 'Indie'       },
  { id: 'ROCK',       icon: '🤘', label: 'Rock'        },
  { id: 'HOUSE',      icon: '🏠', label: 'House'       },
];

export function ChartsScreen() {
  const [chartType, setChartType] = useState('hot');
  const [region, setRegion]       = useState('RU');
  const [period, setPeriod]       = useState('24h');
  const [genre, setGenre]         = useState('HIP_HOP');
  const { navigate }              = useUIStore();

  const fetchChart = () => {
    const params = { region, period };
    switch (chartType) {
      case 'hot':     return chartsApi.getHot(params);
      case 'rising':  return chartsApi.getRising(params);
      case 'holders': return chartsApi.getHolders(params);
      case 'new':     return chartsApi.getNew(params);
      case 'volume':  return chartsApi.getVolume(params);
      case 'genre':   return chartsApi.getGenre(genre, params);
      default:        return chartsApi.getHot(params);
    }
  };

  const { data: chart, isLoading } = useQuery({
    queryKey: ['chart', chartType, region, period, genre],
    queryFn:  () => fetchChart().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const entries = chart?.entries || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-3 pb-0"
           style={{ background: 'linear-gradient(180deg, #0D0020 0%, #0A0A12 100%)' }}>
        <div className="font-display font-black text-[24px] text-white tracking-tight mb-0.5">
          Чарты
        </div>
        <div className="text-[12px] text-white/50 mb-3">Обновляется каждые 15 минут</div>

        {/* Chart type tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
          {CHART_TABS.map(tab => (
            <button
              key={tab.id}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full
                         whitespace-nowrap font-display font-bold text-[10px]
                         flex-shrink-0 border transition-all duration-200
                         active:scale-95 cursor-pointer"
              style={chartType === tab.id
                ? { background: '#7C3AFF', color: 'white', borderColor: 'transparent', boxShadow: '0 4px 16px rgba(124,58,255,0.35)' }
                : { background: '#12121F', color: 'rgba(240,238,249,0.6)', borderColor: 'rgba(255,255,255,0.1)' }
              }
              onClick={() => setChartType(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Region filter */}
        <div className="flex gap-2 mb-3">
          {REGIONS.map(r => (
            <button
              key={r.id}
              className="px-3 py-1.5 rounded-lg font-display font-bold text-[10px]
                         border transition-all cursor-pointer"
              style={region === r.id
                ? { background: '#222238', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }
                : { background: 'transparent', color: 'rgba(240,238,249,0.35)', borderColor: 'transparent' }
              }
              onClick={() => setRegion(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex gap-1 mb-3">
          {PERIODS.map(p => (
            <button
              key={p.id}
              className="px-2.5 py-1.5 rounded-[7px] font-display font-bold text-[9px]
                         border transition-all cursor-pointer"
              style={period === p.id
                ? { background: 'rgba(124,58,255,0.15)', color: '#7C3AFF', borderColor: 'rgba(124,58,255,0.3)' }
                : { background: 'transparent', color: 'rgba(240,238,249,0.35)', borderColor: 'transparent' }
              }
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* For you card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-3 rounded-[18px] p-3.5 flex items-center gap-3 cursor-pointer
                     active:scale-98 transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,255,0.1), rgba(0,229,176,0.06))',
            border: '1px solid rgba(124,58,255,0.2)',
          }}
          onClick={() => navigate('for-you')}
        >
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center text-[20px] flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #7C3AFF, #00E5B0)' }}>
            🎯
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-[12px] text-white mb-0.5">Для тебя</div>
            <div className="text-[10px] text-white/50">Персональные рекомендации</div>
          </div>
          <div className="text-[18px] text-white/35">›</div>
        </motion.div>

        {/* Genre selector (when genre tab) */}
        {chartType === 'genre' && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {GENRES.map(g => (
              <button
                key={g.id}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer active:scale-90 transition-transform"
                onClick={() => setGenre(g.id)}
              >
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[20px]
                             border transition-all"
                  style={{
                    background: genre === g.id ? 'rgba(124,58,255,0.2)' : '#12121F',
                    borderColor: genre === g.id ? 'rgba(124,58,255,0.5)' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {g.icon}
                </div>
                <span className="text-[9px] text-white/35 font-display font-bold">{g.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chart list */}
        {isLoading && (
          <div className="flex flex-col gap-2 px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[70px] bg-surface rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/35">
            <div className="text-[40px] mb-3">📊</div>
            <div className="font-display font-bold text-[14px]">Чарт пока пуст</div>
            <div className="text-[12px] mt-1">Треки появятся скоро</div>
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {entries.map((entry: any, i: number) => (
            <TrackCard
              key={entry.track.id}
              track={entry.track}
              rank={entry.rank}
              rankChange={entry.prevRank === null ? null : entry.rank - (entry.prevRank || entry.rank)}
              variant="horizontal"
              index={i}
              plays24h={entry.plays24h}
              tokenChange={entry.tokenChange}
              holderCount={entry.holderCount}
              volume24h={entry.volume24h}
            />
          ))}
        </div>

        <div className="h-5" />
      </div>
    </div>
  );
}
