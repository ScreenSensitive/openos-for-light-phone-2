import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, NativeModules } from 'react-native';

const TM  = NativeModules.ThemeModule || null;
const EPD = NativeModules.EpdModule   || null;
const QT  = NativeModules.QuickTogglesModule || null;

const FONT_MIN = 12;
const FONT_MAX = 22;

const WF_MODES = [
  { label: 'DU',   value: 2, desc: 'Fast, no flash' },
  { label: 'GL16', value: 3, desc: 'Greyscale, richer' },
  { label: 'GC16', value: 4, desc: 'Full compensation, clearest' },
  { label: 'A2',   value: 1, desc: 'Binary, fastest' },
];

function Row({ label, right, fs, fg }) {
  return (
    <View style={[r.row, { minHeight: 52 }]}>
      <Text style={[r.label, { color: fg, fontSize: fs }]}>{label}</Text>
      {right}
    </View>
  );
}

function Toggle({ value, onLabel, offLabel, onPress, fs, fg }) {
  return (
    <TouchableOpacity onPress={onPress} style={r.toggleBtn}>
      <Text style={[r.toggleTxt, { color: fg, fontSize: fs }, value && r.bold]}>
        {value ? (onLabel || 'ON') : (offLabel || 'OFF')}
      </Text>
    </TouchableOpacity>
  );
}

const r = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  label:     { fontWeight: '600', letterSpacing: 1 },
  toggleBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 20 },
  toggleTxt: { letterSpacing: 1 },
  bold:      { fontWeight: '900' },
});

export default function SettingsScreen({
  goBack, theme: t, fontSize: fs = 15,
  onFontSizeChange, onThemeToggle,
  showStatus, onShowStatusToggle,
  useBuiltinKeyboard, onBuiltinKeyboardToggle,
  showToggles, onShowTogglesToggle,
  vibrateStrength, onVibrateStrength,
  alignment, onAlignmentChange,
  showNotifBell, onNotifBellToggle,
}) {
  const [wfMode,     setWfMode]     = useState(2);
  const [hideSysBar, setHideSysBar] = useState(false);
  const [hideNavBar, setHideNavBar] = useState(false);

  useEffect(() => {
    TM?.getWaveformMode().then(m => setWfMode(m)).catch(() => {});
    TM?.getHideSysStatusBar().then(v => setHideSysBar(v)).catch(() => {});
    TM?.getHideNavBar().then(v => setHideNavBar(v)).catch(() => {});
  }, []);

  const incFont = useCallback(() => {
    const next = Math.min(fs + 1, FONT_MAX);
    if (next === fs) return;
    TM?.setFontSize(next).catch(() => {});
    onFontSizeChange?.(next);
  }, [fs, onFontSizeChange]);

  const decFont = useCallback(() => {
    const next = Math.max(fs - 1, FONT_MIN);
    if (next === fs) return;
    TM?.setFontSize(next).catch(() => {});
    onFontSizeChange?.(next);
  }, [fs, onFontSizeChange]);

  const selectWf = useCallback((mode) => {
    setWfMode(mode);
    EPD?.setWaveformMode(mode).catch(() => {});
    TM?.saveWaveformMode(mode).catch(() => {});
  }, []);

  const toggleSysBar = useCallback(() => {
    const next = !hideSysBar;
    setHideSysBar(next);
    TM?.setHideSysStatusBar(next).catch(() => {});
    QT?.setSystemBars(next, hideNavBar).catch(() => {});
  }, [hideSysBar, hideNavBar]);

  const toggleNavBar = useCallback(() => {
    const next = !hideNavBar;
    setHideNavBar(next);
    TM?.setHideNavBar(next).catch(() => {});
    QT?.setSystemBars(hideSysBar, next).catch(() => {});
  }, [hideNavBar, hideSysBar]);

  const fg = t.fg;

  return (
    <View style={[s.screen, { backgroundColor: t.bg }]}>
      <View style={s.header}>
        {goBack && (
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Text style={[s.backTxt, { color: fg, fontSize: fs }]}>BACK</Text>
          </TouchableOpacity>
        )}
        <Text style={[s.title, { color: fg, fontSize: fs + 4 }]}>SETTINGS</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── DISPLAY ─────────────────────────────────────────── */}
        <Text style={[s.section, { color: fg, fontSize: fs - 2 }]}>DISPLAY</Text>

        <Row label="THEME" fs={fs} fg={fg} right={
          <Toggle value={t.isDark} onLabel="DARK" offLabel="LIGHT" onPress={onThemeToggle} fs={fs} fg={fg} />
        }/>

        <Row label="FONT SIZE" fs={fs} fg={fg} right={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={decFont} style={s.fBtn} disabled={fs <= FONT_MIN}>
              <Text style={[s.fBtnTxt, { color: fg, fontSize: fs }]}>A-</Text>
            </TouchableOpacity>
            <Text style={[{ color: fg, fontSize: fs, fontFamily: 'monospace', marginHorizontal: 12 }]}>{fs}</Text>
            <TouchableOpacity onPress={incFont} style={s.fBtn} disabled={fs >= FONT_MAX}>
              <Text style={[s.fBtnTxt, { color: fg, fontSize: fs }]}>A+</Text>
            </TouchableOpacity>
          </View>
        }/>

        <Row label="DATE & BATTERY" fs={fs} fg={fg} right={
          <Toggle value={showStatus} onLabel="SHOWN" offLabel="HIDDEN" onPress={onShowStatusToggle} fs={fs} fg={fg} />
        }/>

        <Row label="SYSTEM STATUS BAR" fs={fs} fg={fg} right={
          <Toggle value={!hideSysBar} onLabel="SHOWN" offLabel="HIDDEN" onPress={toggleSysBar} fs={fs} fg={fg} />
        }/>

        <Row label="NAV BAR" fs={fs} fg={fg} right={
          <Toggle value={!hideNavBar} onLabel="SHOWN" offLabel="HIDDEN" onPress={toggleNavBar} fs={fs} fg={fg} />
        }/>

        {/* ── HOME ────────────────────────────────────────────── */}
        <Text style={[s.section, { color: fg, fontSize: fs - 2 }]}>HOME</Text>

        <Row label="QUICK TOGGLES" fs={fs} fg={fg} right={
          <Toggle value={showToggles} onPress={onShowTogglesToggle} fs={fs} fg={fg} />
        }/>

        <Row label="NOTIF BELL" fs={fs} fg={fg} right={
          <Toggle value={showNotifBell} onPress={onNotifBellToggle} fs={fs} fg={fg} />
        }/>

        <Row label="ALIGNMENT" fs={fs} fg={fg} right={
          <View style={{ flexDirection: 'row' }}>
            {[['LEFT','left'],['MID','center'],['RIGHT','right']].map(([lbl, val]) => (
              <TouchableOpacity key={val} onPress={() => onAlignmentChange(val)}
                style={{ paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' }}>
                <Text style={[{ color: fg, fontSize: fs - 1, letterSpacing: 1 },
                  alignment === val && { fontWeight: '900' }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }/>

        {/* ── KEYBOARD ────────────────────────────────────────── */}
        <Text style={[s.section, { color: fg, fontSize: fs - 2 }]}>KEYBOARD</Text>

        <Row label="TYPE" fs={fs} fg={fg} right={
          <Toggle value={useBuiltinKeyboard} onLabel="BUILT-IN" offLabel="SYSTEM"
            onPress={onBuiltinKeyboardToggle} fs={fs} fg={fg} />
        }/>

        <Row label="VIBRATE" fs={fs} fg={fg} right={
          <View style={{ flexDirection: 'row' }}>
            {[['OFF',0],['LOW',1],['MED',2],['HIGH',3]].map(([label, val]) => (
              <TouchableOpacity key={val} onPress={() => onVibrateStrength(val)}
                style={{ paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' }}>
                <Text style={[{ color: fg, fontSize: fs - 2, letterSpacing: 1 },
                  vibrateStrength === val && { fontWeight: '900' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }/>

        {/* ── EPD ─────────────────────────────────────────────── */}
        <Text style={[s.section, { color: fg, fontSize: fs - 2 }]}>WAVEFORM MODE</Text>

        {WF_MODES.map(m => (
          <TouchableOpacity key={m.value} style={s.wfRow} onPress={() => selectWf(m.value)} activeOpacity={0.6}>
            <Text style={[s.wfDot, { color: fg, fontSize: fs }]}>{wfMode === m.value ? '■' : ' '}</Text>
            <View style={{ marginLeft: 12 }}>
              <Text style={[s.wfLabel, { color: fg, fontSize: fs }]}>{m.label}</Text>
              <Text style={[s.wfDesc, { color: fg, fontSize: fs - 3 }]}>{m.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── ABOUT ───────────────────────────────────────────── */}
        <Text style={[s.section, { color: fg, fontSize: fs - 2 }]}>ABOUT</Text>
        <View style={[r.row, { paddingVertical: 14 }]}>
          <Text style={[r.label, { color: fg, fontSize: fs }]}>OpenOS</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minHeight: 48 },
  backBtn: { marginRight: 16, minHeight: 44, justifyContent: 'center' },
  backTxt: { fontWeight: '700' },
  title:   { fontWeight: '700', letterSpacing: 2 },
  section: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6, fontWeight: '700', letterSpacing: 3 },
  fBtn:    { minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  fBtnTxt: { fontWeight: '700' },
  wfRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minHeight: 52 },
  wfDot:   { width: 18, fontWeight: '900' },
  wfLabel: { fontWeight: '700' },
  wfDesc:  { marginTop: 1 },
});
