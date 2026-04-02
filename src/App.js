import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import theme from './theme';
import { initEpd, doFullUpdate } from './eink';
import HomeScreen     from './screens/HomeScreen';
import PhoneScreen    from './screens/PhoneScreen';
import SmsScreen      from './screens/SmsScreen';
import MusicScreen    from './screens/MusicScreen';
import SettingsScreen from './screens/SettingsScreen';
import AppsScreen     from './screens/AppsScreen';
import NotifScreen    from './screens/NotifScreen';

const TM = NativeModules.ThemeModule || null;

const SCREENS = {
  Home: HomeScreen, Phone: PhoneScreen, Sms: SmsScreen,
  Music: MusicScreen, Settings: SettingsScreen, Apps: AppsScreen,
  Notif: NotifScreen,
};

export default function App() {
  const [stack, setStack]               = useState(['Home']);
  const [themeState, setThemeState]     = useState(theme.current);
  const [fontSize, setFontSize]         = useState(15);
  const [showStatus, setShowStatus]     = useState(true);
  const [useBuiltinKb, setBuiltinKb]    = useState(true);
  const [vibrateStrength, setVibrateStr] = useState(0);
  const [showToggles, setShowToggles]   = useState(true);
  const [alignment, setAlignment]       = useState('center');
  const [showNotifBell, setNotifBell]   = useState(true);

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]).catch(() => {});
    }

    initEpd();

    theme.load().then(t => setThemeState({ ...t }));
    const h = t => setThemeState({ ...t });
    theme.subscribe(h);

    TM?.getFontSize()          .then(v => { if (v >= 12 && v <= 22) setFontSize(v); }).catch(() => {});
    TM?.getShowStatus()        .then(v => setShowStatus(v))    .catch(() => {});
    TM?.getUseBuiltinKeyboard().then(v => setBuiltinKb(v))     .catch(() => {});
    TM?.getVibrateStrength()   .then(v => setVibrateStr(v || 0)).catch(() => {});
    TM?.getShowToggles()       .then(v => setShowToggles(v))   .catch(() => {});
    TM?.getAlignment()         .then(v => { if (v) setAlignment(v); }) .catch(() => {});
    TM?.getShowNotifBell()     .then(v => setNotifBell(v))    .catch(() => {});

    return () => theme.unsubscribe(h);
  }, []);

  const navigate = useCallback((screen) => {
    setStack(prev => [...prev, screen]);
    doFullUpdate(4);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return prev;
      doFullUpdate(4);
      return prev.slice(0, -1);
    });
  }, []);

  const handleFontSize         = useCallback(v => setFontSize(v), []);
  const handleThemeToggle      = useCallback(async () => { await theme.toggle(); doFullUpdate(4); }, []);
  const handleShowStatus       = useCallback(() => { const n = !showStatus; setShowStatus(n); TM?.setShowStatus(n).catch(() => {}); }, [showStatus]);
  const handleBuiltinKb        = useCallback(() => { const n = !useBuiltinKb; setBuiltinKb(n); TM?.setUseBuiltinKeyboard(n).catch(() => {}); }, [useBuiltinKb]);
  const handleVibrate          = useCallback((v) => { setVibrateStr(v); TM?.setVibrateStrength(v).catch(() => {}); }, []);
  const handleShowToggles      = useCallback(() => { const n = !showToggles; setShowToggles(n); TM?.setShowToggles(n).catch(() => {}); }, [showToggles]);
  const handleAlignment        = useCallback(v => { setAlignment(v); TM?.setAlignment(v).catch(() => {}); }, []);
  const handleNotifBell        = useCallback(() => { const n = !showNotifBell; setNotifBell(n); TM?.setShowNotifBell(n).catch(() => {}); }, [showNotifBell]);

  const Screen = SCREENS[stack[stack.length - 1]] || HomeScreen;

  return (
    <View style={[s.root, { backgroundColor: themeState.bg }]}>
      <StatusBar hidden />
      <Screen
        navigate={navigate}
        goBack={stack.length > 1 ? goBack : null}
        theme={themeState}
        fontSize={fontSize}
        onFontSizeChange={handleFontSize}
        onThemeToggle={handleThemeToggle}
        showStatus={showStatus}
        onShowStatusToggle={handleShowStatus}
        useBuiltinKeyboard={useBuiltinKb}
        onBuiltinKeyboardToggle={handleBuiltinKb}
        vibrateStrength={vibrateStrength}
        onVibrateStrength={handleVibrate}
        showToggles={showToggles}
        onShowTogglesToggle={handleShowToggles}
        alignment={alignment}
        onAlignmentChange={handleAlignment}
        showNotifBell={showNotifBell}
        onNotifBellToggle={handleNotifBell}
      />
    </View>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
