import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, NativeModules, NativeEventEmitter, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Keyboard from '../keyboard';

const MM      = NativeModules.MusicModule || null;
const emitter = MM ? new NativeEventEmitter(MM) : null;

const PAGES = ['SEARCH', 'SAVED', 'SETTINGS'];

const QUALITY_LABELS = ['LOW', 'MED', 'HIGH'];
const SOURCE_LABELS  = ['YOUTUBE', 'YT MUSIC'];

export default function MusicScreen({
  goBack, theme: t, fontSize = 15,
  useBuiltinKeyboard = true, vibrateStrength = 0,
}) {
  const [page, setPage]           = useState('SEARCH');
  const [np, setNp]               = useState({ title:'', artist:'', id:'', isPlaying:false, queueIndex:0, queueSize:0 });
  const [favorites, setFavorites] = useState([]);
  const [hearted, setHearted]     = useState(false);
  const [query, setQuery]         = useState('');
  const [status, setStatus]       = useState('');
  const [showKb, setShowKb]       = useState(false);

  // Music settings
  const [quality, setQuality]             = useState(1);
  const [source, setSource]               = useState(0);
  const [confirmUnlike, setConfirmUnlike] = useState(true);

  // Unlike confirmation modal
  const [confirmId, setConfirmId] = useState(null);

  const f = fontSize;

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    MM?.getNowPlaying().then(d => { if (d) { setNp(d); checkHearted(d.id); } }).catch(() => {});
    MM?.getFavorites().then(r => setFavorites(r || [])).catch(() => {});
    MM?.getStreamQuality().then(v => setQuality(v ?? 1)).catch(() => {});
    MM?.getSearchSource().then(v => setSource(v ?? 0)).catch(() => {});
    MM?.getConfirmUnlike().then(v => setConfirmUnlike(v ?? true)).catch(() => {});
    const sub = emitter?.addListener('onNowPlayingChanged', d => {
      if (d) { setNp(d); checkHearted(d.id); }
    });
    return () => sub?.remove();
  }, []);

  function checkHearted(id) {
    if (!id) { setHearted(false); return; }
    MM?.isFavorite(id).then(v => setHearted(v)).catch(() => setHearted(false));
  }

  // ── Search ────────────────────────────────────────────────────────────────

  const doSearch = useCallback(() => {
    const q = query.trim();
    if (!q || !MM) return;
    setStatus('searching');
    setShowKb(false);
    MM.searchAndPlay(q)
      .then(result => {
        setStatus('');
        setQuery('');
        if (result) {
          setNp(prev => ({ ...prev, ...result, isPlaying: true, queueIndex: 0, queueSize: 1 }));
          checkHearted(result.id);
        }
      })
      .catch(() => setStatus('error'));
  }, [query]);

  // ── Playback controls ─────────────────────────────────────────────────────

  const playPause = useCallback(() => {
    np.isPlaying ? MM?.pause() : MM?.resume();
  }, [np.isPlaying]);

  const doNext = useCallback(() => { MM?.next().catch(() => {}); }, []);
  const doPrev = useCallback(() => { MM?.prev().catch(() => {}); }, []);

  const canPrev = np.queueSize > 1 && np.queueIndex > 0;
  const canNext = np.queueSize > 1 && np.queueIndex < np.queueSize - 1;

  // ── Heart toggle (current track) ──────────────────────────────────────────

  const toggleHeart = useCallback(() => {
    if (!np.id) return;
    if (hearted) {
      MM?.removeFavorite(np.id).then(() => {
        setHearted(false);
        setFavorites(prev => prev.filter(f => f.id !== np.id));
      }).catch(() => {});
    } else {
      MM?.addFavorite(np.id, np.title, np.artist).then(() => {
        setHearted(true);
        setFavorites(prev => [...prev, { id: np.id, title: np.title, channel: np.artist }]);
      }).catch(() => {});
    }
  }, [np, hearted]);

  // ── Favorites ─────────────────────────────────────────────────────────────

  const playFromFavorites = useCallback((startIdx) => {
    const ids      = favorites.map(f => f.id);
    const titles   = favorites.map(f => f.title);
    const channels = favorites.map(f => f.channel || '');
    MM?.playQueue(ids, titles, channels, startIdx).catch(() => {});
    setPage('SEARCH'); // Navigate to SEARCH so user sees now-playing
  }, [favorites]);

  const unlikeFav = useCallback((id) => {
    if (confirmUnlike) {
      setConfirmId(id);
    } else {
      doRemoveFav(id);
    }
  }, [confirmUnlike]);

  const doRemoveFav = useCallback((id) => {
    MM?.removeFavorite(id).then(() => {
      setFavorites(prev => prev.filter(f => f.id !== id));
      if (np.id === id) setHearted(false);
    }).catch(() => {});
  }, [np.id]);

  // ── Settings ──────────────────────────────────────────────────────────────

  const setQualitySave = (v) => { setQuality(v); MM?.setStreamQuality(v).catch(() => {}); };
  const setSourceSave  = (v) => { setSource(v);  MM?.setSearchSource(v).catch(() => {}); };

  // ── Back handling ─────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (showKb) { setShowKb(false); return; }
    if (page !== 'SEARCH') { setPage('SEARCH'); return; }
    goBack?.();
  }, [showKb, page, goBack]);

  // ── Sub-components ────────────────────────────────────────────────────────

  const hasNp = !!np.title;

  const iconColor = t.fg;
  const iconSize  = f + 4;

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>

      {/* Unlike confirmation modal */}
      <Modal
        visible={!!confirmId}
        transparent
        animationType="none"
        onRequestClose={() => setConfirmId(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: t.bg, borderColor: t.fg }]}>
            <Text style={[s.modalTitle, { color: t.fg, fontSize: f }]}>REMOVE</Text>
            <Text style={[s.modalMsg, { color: t.fg, fontSize: f - 2 }]}>Remove from saved?</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtn} onPress={() => setConfirmId(null)} activeOpacity={0.6}>
                <Text style={[s.modalBtnTxt, { color: t.fg, fontSize: f }]}>NO</Text>
              </TouchableOpacity>
              <View style={[s.modalDivider, { backgroundColor: t.fg }]} />
              <TouchableOpacity style={s.modalBtn} onPress={() => { const id = confirmId; setConfirmId(null); doRemoveFav(id); }} activeOpacity={0.6}>
                <Text style={[s.modalBtnTxt, { color: t.fg, fontSize: f, fontWeight: '700' }]}>YES</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={s.bar}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: t.fg, fontSize: f + 2 }]}>MUSIC</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabs}>
        {PAGES.map(p => (
          <TouchableOpacity key={p} style={s.tab} onPress={() => { setShowKb(false); setPage(p); }} activeOpacity={0.6}>
            <Text style={[s.tabTxt, { color: t.fg, fontSize: f - 2 }, page === p && s.tabActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── SEARCH PAGE ── */}
      {page === 'SEARCH' && (
        <View style={s.pageWrap}>
          {/* Content shrinks when keyboard is shown */}
          <View style={{ flex: 1, minHeight: 0 }}>
            {/* Now playing card */}
            {hasNp && (
              <View style={s.npCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.npTitle, { color: t.fg, fontSize: f }]} numberOfLines={2}>{np.title}</Text>
                  {!!np.artist && (
                    <Text style={[s.npArtist, { color: t.fg, fontSize: f - 3 }]} numberOfLines={1}>{np.artist}</Text>
                  )}
                </View>
                <TouchableOpacity style={s.heartBtn} onPress={toggleHeart} activeOpacity={0.6}>
                  <Icon
                    name={hearted ? 'favorite' : 'favorite-border'}
                    size={iconSize}
                    color={iconColor}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Controls */}
            {hasNp && (
              <View style={s.controls}>
                <TouchableOpacity onPress={doPrev} style={s.ctrlBtn} activeOpacity={canPrev ? 0.6 : 1}>
                  <Icon name="skip-previous" size={iconSize + 4} color={t.fg} />
                </TouchableOpacity>
                <TouchableOpacity onPress={playPause} style={[s.playBtn, { borderColor: t.fg }]} activeOpacity={0.6}>
                  <Icon name={np.isPlaying ? 'pause' : 'play-arrow'} size={iconSize + 4} color={t.fg} />
                </TouchableOpacity>
                <TouchableOpacity onPress={doNext} style={s.ctrlBtn} activeOpacity={canNext ? 0.6 : 1}>
                  <Icon name="skip-next" size={iconSize + 4} color={t.fg} />
                </TouchableOpacity>
              </View>
            )}

            {/* Search row */}
            <View style={s.searchRow}>
              {useBuiltinKeyboard ? (
                <TouchableOpacity style={s.searchField} onPress={() => setShowKb(v => !v)} activeOpacity={0.8}>
                  <Text style={[s.searchTxt, { color: t.fg, fontSize: f }, !query && s.ph]} numberOfLines={1}>
                    {query || 'SEARCH & PLAY...'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={[s.searchField, s.searchTxt, { color: t.fg, fontSize: f }]}
                  placeholder="SEARCH & PLAY..."
                  placeholderTextColor={t.fg}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={doSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                />
              )}
              <TouchableOpacity
                style={[s.goBtn, { backgroundColor: t.fg }]}
                onPress={doSearch}
                disabled={status === 'searching'}
                activeOpacity={0.7}
              >
                <Text style={[s.goTxt, { color: t.bg, fontSize: f - 2 }]}>
                  {status === 'searching' ? '...' : 'GO'}
                </Text>
              </TouchableOpacity>
            </View>

            {status === 'error' && (
              <Text style={[s.errTxt, { color: t.fg, fontSize: f - 2 }]}>
                NOT FOUND — TRY DIFFERENT SEARCH
              </Text>
            )}
          </View>

          {/* Keyboard pinned at bottom — outside flex-1 content */}
          {useBuiltinKeyboard && showKb && (
            <Keyboard value={query} onChange={setQuery} onSubmit={doSearch}
              theme={t} fontSize={f} vibrateStrength={vibrateStrength} />
          )}
        </View>
      )}

      {/* ── SAVED PAGE ── */}
      {page === 'SAVED' && (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={s.favRow}
              onPress={() => playFromFavorites(index)}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.favTitle, { color: t.fg, fontSize: f }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!!item.channel && (
                  <Text style={[s.favCh, { color: t.fg, fontSize: f - 3 }]} numberOfLines={1}>
                    {item.channel}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={s.heartBtn}
                onPress={() => unlikeFav(item.id)}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="favorite" size={iconSize} color={t.fg} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[s.empty, { color: t.fg, fontSize: f - 1 }]}>
              SEARCH A SONG AND TAP THE HEART TO SAVE IT
            </Text>
          }
        />
      )}

      {/* ── SETTINGS PAGE ── */}
      {page === 'SETTINGS' && (
        <View style={s.settingsPage}>

          <Text style={[s.settSection, { color: t.fg, fontSize: f - 2 }]}>QUALITY</Text>
          <View style={s.settRow}>
            {QUALITY_LABELS.map((lbl, i) => (
              <TouchableOpacity key={i} onPress={() => setQualitySave(i)} style={s.optBtn} activeOpacity={0.6}>
                <Text style={[s.optTxt, { color: t.fg, fontSize: f }, quality === i && s.optSelected]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.settSection, { color: t.fg, fontSize: f - 2 }]}>SEARCH SOURCE</Text>
          <View style={s.settRow}>
            {SOURCE_LABELS.map((lbl, i) => (
              <TouchableOpacity key={i} onPress={() => setSourceSave(i)} style={s.optBtn} activeOpacity={0.6}>
                <Text style={[s.optTxt, { color: t.fg, fontSize: f }, source === i && s.optSelected]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.settSection, { color: t.fg, fontSize: f - 2 }]}>CONFIRM UNLIKE</Text>
          <View style={s.settRow}>
            {[['ON', true], ['OFF', false]].map(([lbl, val]) => (
              <TouchableOpacity key={String(val)} onPress={() => { setConfirmUnlike(val); MM?.setConfirmUnlike(val).catch(() => {}); }} style={s.optBtn} activeOpacity={0.6}>
                <Text style={[s.optTxt, { color: t.fg, fontSize: f }, confirmUnlike === val && s.optSelected]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  bar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
  backBtn:      { marginRight: 16, minHeight: 44, justifyContent: 'center' },
  backTxt:      { fontWeight: '700' },
  title:        { fontWeight: '700', letterSpacing: 2 },
  tabs:         { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6 },
  tab:          { marginRight: 20, paddingVertical: 4 },
  tabTxt:       { letterSpacing: 2 },
  tabActive:    { fontWeight: '900' },
  pageWrap:     { flex: 1 },
  npCard:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, minHeight: 52 },
  npTitle:      { fontWeight: '700' },
  npArtist:     { marginTop: 2 },
  heartBtn:     { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  controls:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  ctrlBtn:      { paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  playBtn:      { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, marginHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  searchField:  { flex: 1, minHeight: 44, justifyContent: 'center' },
  searchTxt:    { fontFamily: 'monospace', letterSpacing: 1 },
  ph:           {},
  goBtn:        { paddingHorizontal: 18, paddingVertical: 10, marginLeft: 10 },
  goTxt:        { fontWeight: '700' },
  errTxt:       { paddingHorizontal: 16, paddingBottom: 8, letterSpacing: 1 },
  favRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  favTitle:     { fontWeight: '600' },
  favCh:        { marginTop: 2 },
  empty:        { textAlign: 'center', marginTop: 32, paddingHorizontal: 24, lineHeight: 22 },
  settingsPage: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  settSection:  { paddingTop: 20, paddingBottom: 8, fontWeight: '700', letterSpacing: 3 },
  settRow:      { flexDirection: 'row', flexWrap: 'wrap' },
  optBtn:       { paddingRight: 24, paddingVertical: 10 },
  optTxt:       { letterSpacing: 1 },
  optSelected:  { fontWeight: '900' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox:     { width: 260, borderWidth: 1, paddingTop: 20, paddingBottom: 0 },
  modalTitle:   { fontWeight: '900', letterSpacing: 3, textAlign: 'center', paddingBottom: 8 },
  modalMsg:     { textAlign: 'center', paddingBottom: 20, paddingHorizontal: 16 },
  modalBtns:    { flexDirection: 'row', borderTopWidth: 1 },
  modalDivider: { width: 1 },
  modalBtn:     { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modalBtnTxt:  { letterSpacing: 2 },
});
