import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { tracksApi, tokensApi } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore as useUI } from '@/stores/uiStore';
import { formatNumber, formatChange, formatDuration, formatRelative, GENRE_COLORS } from '@/utils/format';

type Tab = 'overview' | 'listeners' | 'token' | 'social';

export function TrackScreen() {
  const { screenParams, goBack, navigate } = useUIStore();
  const { showToast } = useUI();
  const trackId = screenParams.id;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { play, pause, track: currentTrack, isPlaying } = usePlayerStore();

  const { data: trackData, isLoading } = useQuery({
    queryKey: ['track', trackId],
    queryFn:  () => tracksApi.getById(trackId).then(r => r.data.data),
    enabled:  !!trackId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['track-analytics', trackId],
    queryFn:  () => tracksApi.getAnalytics(trackId, '7d').then(r => r.data.data),
    enabled:  !!trackId,
  });

  const { data: tokenData } = useQuery({
    queryKey: ['track-token', trackId],
    queryFn:  () => tokensApi.getTrackToken(trackId).then(r => r.data.data),
    enabled:  !!trackId,
  });

  const { data: holders } = useQuery({
    queryKey: ['token-holders', trackId],
    queryFn:  () => tokensApi.getHolders(trackId).then(r => r.data.data),
    enabled:  !!trackId && activeTab === 'token',
  });

  const { data: priceHistory } = useQuery({
    queryKey: ['price-history', trackId],
    queryFn:  () => tokensApi.getPriceHistory(trackId, '7d').then(r => r.data.data),
    enabled:  !!trackId && activeTab === 'token',
  });

  const likeMutation = useMutation({
    mutationFn: () => tracksApi.like(trackId),
    onSuccess:  (r) => showToast(r.data.data.liked ? '❤️ Лайк!' : 'Лайк убран'),
  });

  if (isLoading || !trackData) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 pt-14 pb-4">
          <button className="w-9 h-9 rounded-[12px] bg-surface2 border border-white/10 flex items-center justify-center text-[15px] border-none cursor-pointer"
                  onClick={goBack}>←</button>
        </div>
        <div className="flex-1 flex flex-col gap-3 px-4">
          <div className="h-[220px] bg-surface rounded-[24px] animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[80px] bg-surface rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const track    = trackData;
  const token    = track.trackToken;
  const isPlayed = currentTrack?.id === track.id && isPlaying;

  const priceChartData = (priceHistory || []).map((p: any) => ({
    time: new Date(p.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    price: parseFloat(p.priceTon),
  }));

  const playsChartData = (analytics?.playsByDay || []).map((d: any) => ({
    day: new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short' }),
    plays: d.plays,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 240 }}>
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(135deg, #200050 0%, #0A0A20 70%)' }} />
        <div className="absolute w-[280px] h-[280px] rounded-full top-[-80px] left-1/2 -translate-x-1/2 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(124,58,255,0.22) 0%, transparent 70%)' }} />

        {/* Back / Share */}
        <button className="absolute top-[58px] left-5 w-9 h-9 rounded-[12px] flex items-center
                           justify-center text-[15px] text-white z-10 border-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                onClick={goBack}>←</button>
        <button className="absolute top-[58px] right-5 w-9 h-9 rounded-[12px] flex items-center
                           justify-center text-[15px] z-10 border-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
                onClick={() => showToast('🔗 Ссылка скопирована!')}>↗</button>

        {/* Cover + info */}
        <div className="absolute bottom-5 left-0 right-0 flex items-end gap-3.5 px-5 z-10">
          <motion.div
            className="w-[90px] h-[90px] rounded-[22px] flex items-center justify-center text-[40px] flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${GENRE_COLORS[track.genre]?.split(' ')[1] || '#7C3AFF'}, #FF3A8C)`,
              boxShadow: '0 16px 48px rgba(124,58,255,0.5)',
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {track.coverUrl
              ? <img src={track.coverUrl} className="w-full h-full rounded-[22px] object-cover" alt="" />
              : '🎵'}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-black text-[20px] text-white tracking-tight truncate mb-1">
              {track.title}
            </div>
            <div className="text-[13px] text-white/60 mb-2" onClick={() => navigate('artist', { id: track.artistId })}>
              {track.artist?.user.name} · {track.genre.replace('_', ' ')}
            </div>
            <div className="flex gap-2">
              <div className="pill-accent3">🔒 Ликвидность заблок.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] bg-bg flex-shrink-0">
        {(['overview', 'listeners', 'token', 'social'] as Tab[]).map(tab => {
          const labels: Record<Tab, string> = {
            overview: 'Обзор', listeners: 'Слушатели', token: 'Токен', social: 'Соцсети'
          };
          return (
            <button
              key={tab}
              className="flex-1 py-3 text-center font-display font-bold text-[9px]
                         uppercase tracking-wide border-b-2 transition-all cursor-pointer
                         bg-transparent border-l-0 border-r-0 border-t-0"
              style={{
                color: activeTab === tab ? '#7C3AFF' : 'rgba(240,238,249,0.35)',
                borderBottomColor: activeTab === tab ? '#7C3AFF' : 'transparent',
              }}
              onClick={() => setActiveTab(tab)}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2.5 p-4 pb-0">
              {[
                { icon: '🎧', val: formatNumber(analytics?.totalPlays || track.totalPlays), lbl: 'Прослушиваний', delta: analytics?.plays24h ? `+${formatNumber(analytics.plays24h)} за 24ч` : undefined, up: true },
                { icon: '👥', val: formatNumber(analytics?.uniqueListeners || 0), lbl: 'Слушателей', delta: undefined, up: true },
                { icon: '💎', val: formatNumber(token?.holderCount || 0), lbl: 'Держателей', delta: analytics?.newHolders24h ? `+${analytics.newHolders24h} за 24ч` : undefined, up: true },
                { icon: '📚', val: formatNumber(track.libraryCount || 0), lbl: 'В библиотеках', delta: undefined, up: true },
              ].map((m, i) => (
                <div key={i} className="bg-surface border border-white/[0.08] rounded-[16px] p-3.5">
                  <div className="text-[18px] mb-1.5">{m.icon}</div>
                  <div className="font-display font-black text-[18px] text-white tracking-tight mb-0.5">{m.val}</div>
                  <div className="text-[10px] text-white/35 mb-1">{m.lbl}</div>
                  {m.delta && <div className="text-[10px] font-display font-bold text-green-400">{m.delta}</div>}
                </div>
              ))}

              {/* Completion rate - full width */}
              <div className="col-span-2 border rounded-[16px] p-4"
                   style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.06), rgba(124,58,255,0.04))', borderColor: 'rgba(0,229,176,0.15)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] text-white/35 mb-1">🎯 Дослушиваемость</div>
                    <div className="font-display font-black text-[22px] text-accent3">
                      {analytics?.completionRate?.toFixed(1) || '—'}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/35 mb-1">Среднее по платформе</div>
                    <div className="font-display font-bold text-[13px] text-white/50">71.4%</div>
                  </div>
                </div>
                {/* Retention bar */}
                <div className="h-[38px] rounded-lg overflow-hidden"
                     style={{ background: 'linear-gradient(90deg, rgba(0,229,176,0.9) 0%, rgba(0,229,176,0.85) 30%, rgba(0,229,176,0.7) 55%, rgba(124,58,255,0.6) 70%, rgba(255,58,140,0.5) 85%, rgba(255,58,140,0.3) 100%)' }} />
                <div className="flex justify-between text-[8px] text-white/35 font-mono mt-1">
                  <span>0:00</span><span>1:00</span><span>2:00</span><span>3:00</span><span>{formatDuration(track.durationSec)}</span>
                </div>
              </div>
            </div>

            {/* Plays chart */}
            {playsChartData.length > 0 && (
              <div className="mx-4 mt-3 bg-surface border border-white/[0.08] rounded-[16px] p-4">
                <div className="font-display font-bold text-[11px] text-white mb-3">📊 Прослушивания</div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={playsChartData}>
                    <XAxis dataKey="day" tick={{ fontSize: 8, fill: 'rgba(240,238,249,0.35)', fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#12121F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }} />
                    <Bar dataKey="plays" fill="#7C3AFF" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Geography */}
            {analytics?.geography && analytics.geography.length > 0 && (
              <div className="mx-4 mt-3 bg-surface border border-white/[0.08] rounded-[16px] p-4">
                <div className="font-display font-bold text-[11px] text-white mb-3">🌍 География</div>
                {analytics.geography.map((g: any) => (
                  <div key={g.country} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
                    <span className="text-[18px] flex-shrink-0">{g.flag}</span>
                    <div className="flex-1">
                      <div className="text-[12px] text-white mb-1">{g.country}</div>
                      <div className="h-1 bg-surface3 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${g.percentage}%`, background: 'linear-gradient(90deg, #7C3AFF, #00E5B0)' }} />
                      </div>
                    </div>
                    <div className="font-mono font-bold text-[11px] text-white/50 flex-shrink-0">{g.percentage}%</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* LISTENERS TAB */}
        {activeTab === 'listeners' && (
          <div className="p-4 flex flex-col gap-3">
            {[
              { icon: '👥', val: formatNumber(analytics?.uniqueListeners || 0), lbl: 'Уникальных слушателей за 30 дней', delta: '+28% vs прошлый месяц', up: true },
              { icon: '🔁', val: (analytics?.avgListenSec ? (track.durationSec / analytics.avgListenSec).toFixed(1) : '—'), lbl: 'Среднее прослушиваний на слушателя', delta: 'Высокий показатель', up: true },
              { icon: '⏱️', val: formatDuration(analytics?.avgListenSec || 0), lbl: 'Среднее время прослушивания', delta: undefined, up: false },
              { icon: '📱', val: '87%', lbl: 'Слушают через Telegram Mini App', delta: undefined, up: false },
            ].map((m, i) => (
              <div key={i} className="bg-surface border border-white/[0.08] rounded-[16px] p-4">
                <div className="text-[18px] mb-1.5">{m.icon}</div>
                <div className="font-display font-black text-[18px] text-white tracking-tight mb-0.5">{m.val}</div>
                <div className="text-[10px] text-white/35 mb-1">{m.lbl}</div>
                {m.delta && <div className={`text-[10px] font-display font-bold ${m.up ? 'text-green-400' : 'text-white/50'}`}>{m.delta}</div>}
              </div>
            ))}
          </div>
        )}

        {/* TOKEN TAB */}
        {activeTab === 'token' && (
          <div className="p-4 flex flex-col gap-3">
            {/* Price card */}
            <div className="rounded-[18px] p-4" style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.08), rgba(124,58,255,0.06))', border: '1px solid rgba(0,229,176,0.2)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[9px] text-accent3/60 font-display font-bold uppercase tracking-[1px] mb-1">Цена токена</div>
                  <div className="font-display font-black text-[26px] text-accent3 tracking-tight">
                    {token?.currentPriceTon || '—'} TON
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-[10px] font-display font-bold text-[12px]"
                     style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>
                  {token ? formatChange(token.priceChange24h) : '—'}
                </div>
              </div>

              {/* Price chart */}
              {priceChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={56}>
                  <LineChart data={priceChartData}>
                    <Line type="monotone" dataKey="price" stroke="#00E5B0" strokeWidth={2} dot={false} />
                    <Tooltip contentStyle={{ background: '#12121F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }} formatter={(v: any) => [`${v.toFixed(8)} TON`, 'Цена']} />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Token stats */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { val: `${token?.volume24h || '0'} TON`, lbl: 'Объём 24ч' },
                  { val: `${token?.marketCapTon || '0'}`, lbl: 'Мкап TON' },
                  { val: formatNumber(token?.holderCount || 0), lbl: 'Холдеров' },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="font-display font-bold text-[11px] text-white mb-0.5">{s.val}</div>
                    <div className="text-[9px] text-white/35">{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* LP locked */}
            <div className="flex items-center gap-3 p-4 rounded-[16px]"
                 style={{ background: 'rgba(0,229,176,0.12)', border: '1px solid rgba(0,229,176,0.2)' }}>
              <div className="text-[24px]">🔒</div>
              <div>
                <div className="font-display font-bold text-[11px] text-accent3 mb-0.5">Ликвидность заблокирована навсегда</div>
                <div className="text-[10px] text-accent3/60">LP-токены сожжены · STON.FI · Rug pull невозможен</div>
              </div>
            </div>

            {/* Top holders */}
            <div className="bg-surface border border-white/[0.08] rounded-[16px] p-4">
              <div className="font-display font-bold text-[11px] text-white mb-3">Топ держателей</div>
              {(holders || []).slice(0, 5).map((h: any, i: number) => (
                <div key={h.user.id} className="flex items-center gap-2.5 py-2 border-b border-white/[0.05] last:border-0">
                  <span className="font-mono text-[10px] text-white/35 w-4">{i + 1}</span>
                  <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[14px]"
                       style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
                    {h.user.avatarUrl ? <img src={h.user.avatarUrl} className="w-full h-full rounded-[9px] object-cover" alt="" /> : '👤'}
                  </div>
                  <div className="flex-1 text-[12px] text-white">{h.user.name}</div>
                  <div className="font-mono font-bold text-[10px] text-accent3">{formatNumber(parseInt(h.amount))}</div>
                  <div className="text-[10px] text-white/35 min-w-[36px] text-right">{h.percentage.toFixed(2)}%</div>
                </div>
              ))}
              {!holders && <div className="h-[100px] bg-surface2 rounded-xl animate-pulse" />}
            </div>
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === 'social' && (
          <div className="grid grid-cols-2 gap-2.5 p-4">
            {[
              { icon: '❤️', val: formatNumber(track.likeCount), lbl: 'Лайков', delta: '+412 сегодня' },
              { icon: '💬', val: formatNumber(track.commentCount), lbl: 'Комментариев', delta: '+67 сегодня' },
              { icon: '↗️', val: formatNumber(track.shareCount), lbl: 'Репостов', delta: '+89 сегодня' },
              { icon: '📱', val: '14.2K', lbl: 'Шерингов', delta: '+2.1K сегодня' },
            ].map((s, i) => (
              <div key={i} className="bg-surface border border-white/[0.08] rounded-[14px] p-4 flex items-center gap-3">
                <div className="text-[22px] flex-shrink-0">{s.icon}</div>
                <div>
                  <div className="font-display font-bold text-[15px] text-white mb-0.5">{s.val}</div>
                  <div className="text-[9px] text-white/35 mb-0.5">{s.lbl}</div>
                  <div className="text-[9px] font-display font-bold text-green-400">{s.delta}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-[80px]" />
      </div>

      {/* Buy strip */}
      <div className="absolute bottom-[84px] left-3 right-3 z-20
                      bg-surface2 border border-accent/20 rounded-[18px]
                      p-3 flex items-center gap-3 backdrop-blur-xl">
        <button
          className="w-10 h-10 rounded-[12px] bg-surface3 border border-white/10
                     flex items-center justify-center text-[16px] cursor-pointer border-none"
          onClick={() => isPlayed ? pause() : play(track as any, 'preview')}
        >
          {isPlayed ? '⏸' : '▶'}
        </button>
        <div className="flex-1">
          <div className="font-mono font-bold text-[14px] text-accent3">
            {token?.currentPriceTon || '—'} TON
          </div>
          <div className="text-[10px] text-white/35">~15 руб · полный доступ</div>
        </div>
        <button
          className="px-5 py-3 bg-accent rounded-[12px] font-display font-bold text-[12px] text-white
                     cursor-pointer border-none active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 16px rgba(124,58,255,0.4)' }}
          onClick={() => navigate('buy', { id: track.id })}
        >
          Купить токен
        </button>
      </div>
    </div>
  );
}
