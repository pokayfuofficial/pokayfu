import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { usersApi, artistsApi } from '@/api/client';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { formatNumber, formatChange, formatRelative } from '@/utils/format';

// ══════════════════════════════════════
//  LIBRARY SCREEN
// ══════════════════════════════════════
export function LibraryScreen() {
  const { navigate } = useUIStore();

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn:  () => usersApi.getPortfolio().then(r => r.data.data),
  });

  const { data: library } = useQuery({
    queryKey: ['library'],
    queryFn:  () => usersApi.getLibrary().then(r => r.data.data),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-3 pb-3">
        <div className="font-display font-black text-[24px] text-white tracking-tight mb-0.5">Библиотека</div>
        <div className="text-[12px] text-white/50">Твои токены и треки</div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Portfolio card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 rounded-[22px] p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1A003A, #0D0D24)', border: '1px solid rgba(124,58,255,0.25)' }}
        >
          <div className="absolute w-[180px] h-[180px] rounded-full top-[-60px] right-[-40px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(124,58,255,0.2) 0%, transparent 70%)' }} />
          <div className="text-[10px] text-white/40 uppercase tracking-[1.5px] mb-1.5">Стоимость портфеля</div>
          <div className="font-display font-black text-[30px] text-white tracking-tight mb-1">
            {isLoading ? '—' : `${parseFloat(portfolio?.totalValueTon || '0').toFixed(2)} TON`}
          </div>
          <div className="text-[13px] text-green-400 mb-4">
            ↑ {portfolio?.pnlPercent?.toFixed(1) || '0'}% за всё время
          </div>
          <div className="flex gap-2.5">
            {[
              { lbl: 'Artist Tokens', val: `${parseFloat(portfolio?.artistTokensValue || '0').toFixed(2)} TON`, color: '#7C3AFF' },
              { lbl: 'Track Tokens',  val: `${parseFloat(portfolio?.trackTokensValue || '0').toFixed(2)} TON`, color: '#00E5B0' },
              { lbl: 'Royalty Flow',  val: `+${portfolio?.royaltyEarned || '0'} TON`, color: '#34D399' },
            ].map((s, i) => (
              <div key={i} className="flex-1 bg-white/[0.06] rounded-[12px] p-2.5">
                <div className="text-[9px] text-white/40 mb-1 uppercase">{s.lbl}</div>
                <div className="font-display font-bold text-[12px]" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Artist tokens */}
        {(library?.artistHoldings || []).length > 0 && (
          <>
            <div className="px-5 mb-2 font-display font-bold text-[13px] text-white">💎 Artist Tokens</div>
            {library!.artistHoldings.map((h: any) => (
              <div key={h.id}
                   className="mx-4 mb-2.5 bg-surface border border-white/10 rounded-[18px] p-3.5
                              flex items-center gap-3 cursor-pointer active:bg-surface2 transition-colors"
                   onClick={() => navigate('artist', { id: h.artistToken?.artistId })}>
                <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
                  {h.artistToken?.artist?.user?.avatarUrl
                    ? <img src={h.artistToken.artist.user.avatarUrl} className="w-full h-full rounded-[14px] object-cover" alt="" />
                    : '👤'}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-[12px] text-white mb-0.5">
                    {h.artistToken?.artist?.user?.name || '—'}
                  </div>
                  <div className="text-[10px] text-white/35 mb-1.5">
                    {formatNumber(parseInt(h.amount || '0'))} токенов
                  </div>
                  <div className="pill-accent3 text-[9px]">⚡ Royalty Flow активен</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-[14px] text-accent">
                    {h.currentValue || '—'} TON
                  </div>
                  <div className={`text-[10px] ${(h.pnlPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatChange(h.pnlPercent || 0)}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Track tokens */}
        <div className="px-5 mt-2 mb-2 font-display font-bold text-[13px] text-white">🎵 Токены треков</div>
        {(library?.trackHoldings || []).map((h: any, i: number) => (
          <div key={h.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer
                                     border-b border-white/[0.04] active:bg-white/[0.02]
                                     transition-colors"
               onClick={() => navigate('track', { id: h.trackToken?.trackId })}>
            <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center
                            text-[22px] flex-shrink-0 relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
              {h.trackToken?.track?.coverUrl
                ? <img src={h.trackToken.track.coverUrl} className="absolute inset-0 w-full h-full object-cover" alt="" />
                : '🎵'}
              <div className="absolute bottom-[-3px] right-[-3px] w-[18px] h-[18px]
                              rounded-[5px] bg-bg border border-white/10
                              flex items-center justify-center text-[10px]">▶</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[12px] text-white truncate mb-0.5">
                {h.trackToken?.track?.title || '—'}
              </div>
              <div className="text-[11px] text-white/50 mb-1">
                {h.trackToken?.track?.artist?.user?.name || '—'}
              </div>
              <div className="font-mono text-[10px] text-white/35">
                {formatNumber(parseInt(h.amount || '0'))} {h.trackToken?.ticker || ''}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-display font-bold text-[13px] text-white mb-0.5">
                {h.currentValue || '—'} TON
              </div>
              <div className={`text-[10px] ${(h.pnlPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatChange(h.pnlPercent || 0)}
              </div>
            </div>
          </div>
        ))}

        {(!library || (library.trackHoldings.length === 0 && library.artistHoldings.length === 0)) && !isLoading && (
          <div className="flex flex-col items-center py-16 text-white/35">
            <div className="text-[48px] mb-3">📚</div>
            <div className="font-display font-bold text-[14px]">Библиотека пуста</div>
            <div className="text-[12px] mt-1">Купи токены любимых треков</div>
          </div>
        )}

        <div className="h-5" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════
//  ARTISTS SCREEN
// ══════════════════════════════════════
export function ArtistsScreen() {
  const { navigate } = useUIStore();

  const { data: artists, isLoading } = useQuery({
    queryKey: ['artists', 'top', 30],
    queryFn:  () => artistsApi.getTop(30).then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-3 pb-3">
        <span className="font-display font-black text-[24px] text-white tracking-tight">Артисты</span>
        <button className="w-[38px] h-[38px] rounded-[12px] bg-surface2 border border-white/10
                           flex items-center justify-center text-[17px] cursor-pointer border-none">🔍</button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex flex-col gap-2.5 px-4">
          {isLoading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[80px] bg-surface rounded-[18px] animate-pulse" />
          ))}

          {(artists || []).map((artist: any, i: number) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-surface border border-white/10 rounded-[18px] p-3.5
                         flex items-center gap-3.5 cursor-pointer active:bg-surface2 transition-colors"
              onClick={() => navigate('artist', { id: artist.id })}
            >
              <div className="w-14 h-14 rounded-[16px] flex items-center justify-center text-[26px] flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
                {artist.user.avatarUrl
                  ? <img src={artist.user.avatarUrl} className="w-full h-full rounded-[16px] object-cover" alt="" />
                  : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[14px] text-white mb-0.5">{artist.user.name}</div>
                <div className="text-[11px] text-white/50 mb-1.5">
                  {artist.genres?.map((g: string) => g.replace('_', ' ')).join(' · ')} · {artist._count?.tracks} треков
                </div>
                <div className="flex gap-1.5">
                  {artist.artistToken && (
                    <div className="pill-accent text-[9px]">AT: {parseFloat(artist.artistToken.currentPriceTon).toFixed(4)} TON</div>
                  )}
                  {artist.artistToken && (
                    <div className="pill-accent3 text-[9px]">⚡ Royalty Flow</div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-[12px] text-white">
                  {formatNumber(artist._count?.follows || 0)}
                </div>
                <div className="text-[10px] text-white/35">подписчиков</div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="h-5" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════
//  ARTIST PROFILE SCREEN
// ══════════════════════════════════════
export function ArtistScreen() {
  const { screenParams, goBack, navigate, showToast } = useUIStore();
  const artistId = screenParams.id;

  const { data: artist, isLoading } = useQuery({
    queryKey: ['artist', artistId],
    queryFn:  () => artistsApi.getById(artistId).then(r => r.data.data),
    enabled:  !!artistId,
  });

  const { data: tracks } = useQuery({
    queryKey: ['artist-tracks', artistId],
    queryFn:  () => artistsApi.getTracks(artistId).then(r => r.data.data),
    enabled:  !!artistId,
  });

  const { data: stats } = useQuery({
    queryKey: ['artist-stats', artistId],
    queryFn:  () => artistsApi.getStats(artistId).then(r => r.data.data),
    enabled:  !!artistId,
  });

  const followMutation = useMutation({
    mutationFn: () => artistsApi.follow(artistId),
    onSuccess:  (r) => showToast(r.data.data.following ? '✅ Подписался!' : 'Отписался'),
  });

  if (isLoading || !artist) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-[210px] bg-surface animate-pulse" />
        <div className="p-4 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[60px] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Hero */}
      <div className="relative flex-shrink-0" style={{ height: 210 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1A003A, #0A0A20 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 200px 200px at 80% 20%, rgba(124,58,255,0.3) 0%, transparent 70%), radial-gradient(ellipse 150px 150px at 20% 80%, rgba(255,58,140,0.2) 0%, transparent 70%)' }} />

        <button className="absolute top-[58px] left-5 w-9 h-9 rounded-[12px] flex items-center justify-center z-10 border-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', color: 'white', fontSize: 15 }}
                onClick={goBack}>←</button>
        <button className="absolute top-[58px] right-5 w-9 h-9 rounded-[12px] flex items-center justify-center z-10 border-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', fontSize: 15 }}
                onClick={() => showToast('🔗 Ссылка скопирована!')}>↗</button>

        {/* Avatar */}
        <div className="absolute bottom-[-36px] left-5 w-[78px] h-[78px] rounded-[22px] z-10 flex items-center justify-center text-[34px]"
             style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)', border: '3px solid #0A0A12', boxShadow: '0 8px 32px rgba(124,58,255,0.4)' }}>
          {artist.user.avatarUrl ? <img src={artist.user.avatarUrl} className="w-full h-full rounded-[22px] object-cover" alt="" /> : '👤'}
        </div>
        <div className="absolute bottom-[-36px] left-[82px] w-[22px] h-[22px] bg-accent rounded-full z-10
                        flex items-center justify-center text-[11px]"
             style={{ border: '2px solid #0A0A12' }}>✓</div>
      </div>

      {/* Info */}
      <div className="px-5 pt-14 pb-0">
        <div className="font-display font-black text-[22px] text-white tracking-tight mb-0.5">{artist.user.name}</div>
        <div className="text-[12px] text-white/50 mb-3">
          {artist.genres?.map((g: string) => g.replace('_', ' ')).join(' · ')}
          {artist.country && ` · ${artist.country}`}
        </div>
        <div className="flex gap-2.5 mb-5">
          <button
            className="flex-1 py-3 bg-accent rounded-[14px] font-display font-bold text-[12px] text-white
                       cursor-pointer border-none active:scale-95 transition-transform"
            style={{ boxShadow: '0 4px 16px rgba(124,58,255,0.4)' }}
            onClick={() => followMutation.mutate()}
            disabled={followMutation.isPending}
          >
            + Подписаться
          </button>
          <button
            className="px-5 py-3 bg-surface2 border border-white/10 rounded-[14px] font-display
                       font-bold text-[12px] text-white/60 cursor-pointer border-solid
                       active:scale-95 transition-transform"
            onClick={() => showToast('💸 Tip скоро появится!')}
          >
            💸 Tip
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex mx-4 mb-4 bg-surface border border-white/10 rounded-[18px] overflow-hidden">
        {[
          { val: stats?.totalTracks || artist._count?.tracks || 0, lbl: 'Треков' },
          { val: formatNumber(artist._count?.follows || 0), lbl: 'Подписчиков' },
          { val: stats ? `${parseFloat(stats.totalVolume || '0').toFixed(1)} TON` : '—', lbl: 'Объём', color: '#00E5B0' },
        ].map((s, i) => (
          <div key={i} className="flex-1 py-3 text-center border-r border-white/[0.06] last:border-0">
            <div className="font-display font-bold text-[14px] mb-0.5" style={{ color: s.color || '#F0EEF9' }}>{s.val}</div>
            <div className="text-[9px] text-white/35 uppercase">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Token cards */}
      <div className="px-5 mb-2 font-display font-bold text-[13px] text-white">💎 Токены</div>
      <div className="flex gap-2.5 px-4 mb-4">
        {[
          { label: 'Artist Token', price: artist.artistToken?.currentPriceTon, change: artist.artistToken?.priceChange24h, color: '#7C3AFF', borderColor: 'rgba(124,58,255,0.3)', bg: 'rgba(124,58,255,0.15)' },
          { label: 'Avg Track', price: '0.018', change: 34.7, color: '#00E5B0', borderColor: 'rgba(0,229,176,0.25)', bg: 'rgba(0,229,176,0.08)' },
        ].map((tok, i) => (
          <div key={i} className="flex-1 rounded-[18px] p-3.5 cursor-pointer active:scale-95 transition-transform"
               style={{ background: tok.bg, border: `1px solid ${tok.borderColor}` }}
               onClick={() => i === 0 ? navigate('buy', { id: artistId, type: 'artist' }) : navigate('charts')}>
            <div className="text-[9px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: tok.color + 'CC' }}>{tok.label}</div>
            <div className="font-display font-black text-[16px] mb-0.5" style={{ color: tok.color }}>
              {parseFloat(tok.price || '0').toFixed(4)} TON
            </div>
            <div className={`text-[10px] mb-2.5 ${(tok.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatChange(tok.change || 0)}
            </div>
            <div className="text-[9px] font-display font-bold px-2 py-1.5 rounded-[9px] text-center cursor-pointer"
                 style={{ background: tok.color + '33', color: tok.color, border: `1px solid ${tok.color}4D` }}>
              {i === 0 ? 'Купить →' : 'Смотреть →'}
            </div>
          </div>
        ))}
      </div>

      {/* Royalty Flow */}
      <div className="mx-4 mb-4 flex items-center gap-3 p-4 rounded-[18px]"
           style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.08), rgba(124,58,255,0.08))', border: '1px solid rgba(0,229,176,0.2)' }}>
        <div className="w-10 h-10 bg-accent3/15 rounded-[12px] flex items-center justify-center text-[20px] flex-shrink-0">💰</div>
        <div className="flex-1">
          <div className="font-display font-bold text-[11px] text-accent3 mb-0.5">Royalty Flow</div>
          <div className="text-[10px] text-white/35">0.25% с каждой сделки → держателям Artist Token</div>
        </div>
        <div className="font-display font-bold text-[14px] text-accent3 text-right">
          +{stats?.royaltyFlow7d || '0'} TON<br />
          <span className="text-[9px] text-white/35 font-normal">за 7 дней</span>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex items-center justify-between px-5 mb-2">
        <span className="font-display font-bold text-[13px] text-white">🎵 Треки</span>
      </div>
      <div className="mx-4 mb-4 bg-surface border border-white/10 rounded-[20px] px-4">
        {(tracks || []).slice(0, 5).map((track: any, i: number) => (
          <div key={track.id}
               className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0 cursor-pointer"
               onClick={() => navigate('track', { id: track.id })}>
            <span className="font-mono text-[10px] text-white/35 w-4 flex-shrink-0">{i + 1}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)' }}>
              {track.coverUrl ? <img src={track.coverUrl} className="w-full h-full rounded-[10px] object-cover" alt="" /> : '🎵'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[11px] text-white truncate">{track.title}</div>
              <div className="text-[10px] text-white/35">
                {formatNumber(track.totalPlays || 0)} прослуш. · {formatNumber(track.trackToken?.holderCount || 0)} держат.
              </div>
            </div>
            <div className="font-mono font-bold text-[11px] text-accent3 flex-shrink-0">
              {parseFloat(track.trackToken?.currentPriceTon || '0').toFixed(6)} TON
            </div>
          </div>
        ))}
        {!tracks && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[56px] bg-surface2 rounded-xl mb-2 animate-pulse" />
        ))}
      </div>

      <div className="h-8" />
    </div>
  );
}

// ══════════════════════════════════════
//  PROFILE SCREEN
// ══════════════════════════════════════
export function ProfileScreen() {
  const { navigate, showToast } = useUIStore();
  const { user } = useAuthStore();

  const { data: referrals } = useQuery({
    queryKey: ['referrals'],
    queryFn:  () => usersApi.getReferrals().then(r => r.data.data),
  });

  const { data: royalty } = useQuery({
    queryKey: ['royalty'],
    queryFn:  () => usersApi.getRoyalty({ status: 'PENDING' }).then(r => r.data.data),
  });

  const copyRef = () => {
    navigator.clipboard.writeText(user?.referralCode || '');
    showToast('✅ Код скопирован!');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Hero */}
      <div className="relative flex-shrink-0" style={{ height: 175 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A002A, #12001A 50%, #0A0A18)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 250px 200px at 90% 50%, rgba(124,58,255,0.2) 0%, transparent 70%)' }} />
        <button className="absolute top-[58px] right-5 w-9 h-9 rounded-[12px] flex items-center justify-center z-10 border-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', fontSize: 16 }}>⚙️</button>
        <div className="absolute bottom-[-36px] left-5 w-[76px] h-[76px] rounded-[22px] z-10 flex items-center justify-center text-[32px]"
             style={{ background: 'linear-gradient(135deg, #7C3AFF, #00E5B0)', border: '3px solid #0A0A12', boxShadow: '0 8px 28px rgba(124,58,255,0.35)' }}>
          {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full rounded-[22px] object-cover" alt="" /> : '😎'}
        </div>
        <div className="absolute bottom-[-36px] left-[82px] flex items-center gap-1.5 px-2.5 py-1 rounded-full z-10 font-display font-bold text-[10px] text-white"
             style={{ background: '#0098EA', border: '2px solid #0A0A12' }}>💎 Telegram</div>
      </div>

      <div className="px-5 pt-14 pb-2">
        <div className="font-display font-black text-[20px] text-white tracking-tight mb-0.5">{user?.name || '—'}</div>
        <div className="text-[12px] text-white/35 mb-3">
          {user?.username ? `@${user.username} · ` : ''}{user?.role === 'ARTIST' ? 'Артист' : 'Слушатель'}
        </div>
        {user?.role !== 'ARTIST' && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-display font-bold text-[10px] text-accent cursor-pointer border-none"
            style={{ background: 'rgba(124,58,255,0.15)', border: '1px solid rgba(124,58,255,0.25)' }}
            onClick={() => navigate('upload')}
          >
            🎙️ Стать артистом → 50 TON
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex mx-4 my-3 bg-surface border border-white/10 rounded-[18px] overflow-hidden">
        {[
          { val: '12.4 TON', lbl: 'Портфель', color: '#00E5B0' },
          { val: '8',        lbl: 'Треков' },
          { val: '2',        lbl: 'Артистов' },
          { val: '+1.8 TON', lbl: 'Royalty', color: '#34D399' },
        ].map((s, i) => (
          <div key={i} className="flex-1 py-3 text-center border-r border-white/[0.06] last:border-0">
            <div className="font-display font-bold text-[13px] mb-0.5" style={{ color: s.color || '#F0EEF9' }}>{s.val}</div>
            <div className="text-[9px] text-white/35 uppercase">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Premium */}
      <div className="mx-4 mb-3 rounded-[20px] p-4 flex items-center gap-3.5 cursor-pointer relative overflow-hidden active:scale-98 transition-transform"
           style={{ background: 'linear-gradient(135deg, #2A0050, #1A0030)', border: '1px solid rgba(124,58,255,0.3)' }}
           onClick={() => showToast('👑 Pokayfu Premium скоро!')}>
        <div className="absolute w-[150px] h-[150px] rounded-full top-[-50px] right-[-30px] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(124,58,255,0.25) 0%, transparent 70%)' }} />
        <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[24px] flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #7C3AFF, #FF3A8C)', boxShadow: '0 4px 16px rgba(124,58,255,0.4)' }}>👑</div>
        <div className="flex-1">
          <div className="font-display font-bold text-[13px] text-white mb-0.5">Pokayfu Premium</div>
          <div className="text-[11px] text-white/50 mb-1">Без рекламы · Эксклюзивный контент</div>
          <div className="font-display font-bold text-[11px] text-accent3">9.9 TON / мес</div>
        </div>
        <div className="px-3.5 py-2.5 bg-accent rounded-[12px] font-display font-bold text-[10px] text-white flex-shrink-0"
             style={{ boxShadow: '0 4px 12px rgba(124,58,255,0.4)' }}>Попробовать</div>
      </div>

      {/* Referral */}
      <div className="mx-4 mb-3 rounded-[20px] p-4 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.1), rgba(124,58,255,0.08))', border: '1px solid rgba(0,229,176,0.2)' }}>
        <div className="absolute w-[120px] h-[120px] rounded-full top-[-30px] right-[-20px] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(0,229,176,0.15) 0%, transparent 70%)' }} />
        <div className="font-display font-bold text-[13px] text-white mb-1">🎁 Реферальная программа</div>
        <div className="text-[11px] text-white/50 mb-3 leading-relaxed">Приведи друга — получите оба по 500 токенов</div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 font-mono font-bold text-[13px] text-accent3 px-3.5 py-2.5 rounded-[10px] tracking-[2px]"
               style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,229,176,0.2)' }}>
            {user?.referralCode || '—'}
          </div>
          <button onClick={copyRef}
                  className="px-4 py-2.5 rounded-[10px] font-display font-bold text-[11px] cursor-pointer border-none active:scale-95 transition-transform"
                  style={{ background: '#00E5B0', color: '#0A1A14' }}>
            Копировать
          </button>
        </div>
        <div className="flex gap-2.5">
          {[
            { val: referrals?.totalReferrals || 0, lbl: 'Приглашено' },
            { val: (referrals?.totalReferrals || 0) * 500, lbl: 'Токенов' },
            { val: `+0.4 TON`, lbl: 'Заработано', color: '#34D399' },
          ].map((s, i) => (
            <div key={i} className="flex-1 rounded-[10px] py-2 text-center"
                 style={{ background: 'rgba(0,0,0,0.2)' }}>
              <div className="font-display font-bold text-[14px] mb-0.5" style={{ color: s.color || '#00E5B0' }}>{s.val}</div>
              <div className="text-[9px] text-white/35">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="mx-4 mb-4 bg-surface border border-white/10 rounded-[20px] overflow-hidden">
        {[
          { icon: '💼', iconBg: 'rgba(124,58,255,0.12)', title: 'Мой портфель', sub: 'Токены и история сделок', badge: '+29.2%', badgeColor: '#34D399', badgeBg: 'rgba(52,211,153,0.12)', onClick: () => useUIStore.getState().setTab('library') },
          { icon: '⚡', iconBg: 'rgba(0,229,176,0.1)',   title: 'Royalty Flow',  sub: 'Пассивный доход от артистов', badge: `+${royalty?.pendingTon || '0'} TON`, badgeColor: '#34D399', badgeBg: 'rgba(52,211,153,0.12)', onClick: () => showToast('⚡ Royalty Flow') },
          { icon: '🔔', iconBg: 'rgba(255,58,140,0.1)',  title: 'Уведомления',   sub: 'Новые треки и изменения цен', badge: '3 новых', badgeColor: '#7C3AFF', badgeBg: 'rgba(124,58,255,0.15)', onClick: () => showToast('🔔 Нет новых уведомлений') },
          { icon: '🎵', iconBg: 'rgba(124,58,255,0.12)', title: 'Загрузить трек',sub: 'Стать артистом · 50 TON', badge: undefined, onClick: () => navigate('upload') },
          { icon: '❓', iconBg: 'rgba(255,255,255,0.05)', title: 'Поддержка',     sub: 'Помощь и вопросы', badge: undefined, onClick: () => showToast('❓ Поддержка скоро!') },
        ].map((item, i) => (
          <div key={i}
               className="flex items-center gap-3.5 px-4 py-3.5 border-b border-white/[0.05] last:border-0 cursor-pointer active:bg-white/[0.02] transition-colors"
               onClick={item.onClick}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0"
                 style={{ background: item.iconBg }}>{item.icon}</div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-white mb-0.5">{item.title}</div>
              <div className="text-[10px] text-white/35">{item.sub}</div>
            </div>
            {item.badge && (
              <div className="px-2.5 py-1 rounded-full font-display font-bold text-[9px]"
                   style={{ background: item.badgeBg, color: item.badgeColor }}>{item.badge}</div>
            )}
            <span className="text-[16px] text-white/35">›</span>
          </div>
        ))}
      </div>

      <div className="h-8" />
    </div>
  );
}
