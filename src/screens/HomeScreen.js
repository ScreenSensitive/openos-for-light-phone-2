import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeModules } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const TM = NativeModules.ThemeModule || null;
const QT = NativeModules.QuickTogglesModule || null;
const PM = NativeModules.PhoneModule || null;
const SM = NativeModules.SmsModule || null;
const NM = NativeModules.NotificationsModule || null;

const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function getTime() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function getDate() { const d = new Date(); return DAYS[d.getDay()] + '  ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

const BASE_APPS = [
  { label: 'PHONE',    screen: 'Phone',    badge: 'phone' },
  { label: 'MESSAGES', screen: 'Sms',      badge: 'sms' },
  { label: 'MUSIC',    screen: 'Music',    badge: null },
  { label: 'APPS',     screen: 'Apps',     badge: null },
  { label: 'SETTINGS', screen: 'Settings', badge: null },
];

const BRIGHT_STEPS = [-1, 0, 25, 50, 75, 100];
function brightLabel(v) {
  if (v === -1) return 'AUTO';
  if (v === 0)  return 'OFF';
  return v + '%';
}

export default function HomeScreen({
  navigate, theme: t, fontSize = 15,
  showStatus = true, showToggles = true,
  alignment = 'left', showNotifBell = true,
}) {
  const [time, setTime]           = useState(getTime);
  const [date, setDate]           = useState(getDate);
  const [battery, setBat]         = useState(null);
  const [missed, setMissed]       = useState(0);
  const [unread, setUnread]       = useState(0);
  const [notifCount, setNotifCnt] = useState(0);
  const togglesRef = useRef({ airplane: false, bluetooth: false, brightness: 50, gps: false });
  const [toggles, setToggles] = useState(togglesRef.current);
  const f = fontSize;
  const align = alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left';

  useEffect(() => { togglesRef.current = toggles; }, [toggles]);

  useEffect(() => {
    const tick = () => { setTime(getTime()); setDate(getDate()); };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showStatus) return;
    const fetch = () => TM?.getBatteryLevel().then(l => setBat(l)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 60000);
    return () => clearInterval(id);
  }, [showStatus]);

  useEffect(() => {
    QT?.getAll().then(s => { if (s) setToggles(s); }).catch(() => {});
  }, []);

  useEffect(() => {
    const poll = () => {
      PM?.getMissedCallCount().then(n => setMissed(n || 0)).catch(() => {});
      SM?.getUnreadCount().then(n => setUnread(n || 0)).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showNotifBell) return;
    const poll = () => NM?.getCount().then(n => setNotifCnt(n || 0)).catch(() => {});
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [showNotifBell]);

  function tapAirplane() {
    const next = !togglesRef.current.airplane;
    setToggles(prev => ({ ...prev, airplane: next }));
    QT?.setAirplaneMode(next).catch(() => {});
  }
  function tapBluetooth() {
    const next = !togglesRef.current.bluetooth;
    setToggles(prev => ({ ...prev, bluetooth: next }));
    QT?.setBluetooth(next).catch(() => {});
  }
  function tapBrightness() {
    const cur = togglesRef.current.brightness;
    const idx = BRIGHT_STEPS.indexOf(cur);
    const next = BRIGHT_STEPS[(idx + 1) % BRIGHT_STEPS.length];
    setToggles(prev => ({ ...prev, brightness: next }));
    QT?.setBrightness(next).catch(() => {});
  }
  function tapGps() {
    const next = !togglesRef.current.gps;
    setToggles(prev => ({ ...prev, gps: next }));
    QT?.setGps(next).catch(() => {});
  }

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Text style={[s.clock, { color: t.fg, fontSize: f * 3 }]}>{time}</Text>

      {/* Status + Bell row */}
      {(showStatus || showNotifBell) && (
        <View style={s.statusRow}>
          <View style={s.statusLeft}>
            {showStatus && (
              <Text style={[s.statusTxt, { color: t.fg, fontSize: f - 2 }]}>{date}</Text>
            )}
          </View>
          <View style={s.statusRight}>
            {showStatus && battery !== null && battery >= 0 && (
              <Text style={[s.statusTxt, { color: t.fg, fontSize: f - 2 }]}>{battery}%</Text>
            )}
            {showNotifBell && (
              <TouchableOpacity onPress={() => navigate('Notif')} style={s.bellBtn} activeOpacity={0.6}>
                <Icon
                  name={notifCount > 0 ? 'notifications' : 'notifications-none'}
                  size={f + 2}
                  color={t.fg}
                />
                {notifCount > 0 && (
                  <Text style={[s.bellCount, { color: t.fg, fontSize: f - 4 }]}>{notifCount}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={s.body}>
        <View style={s.appList}>
          {BASE_APPS.map(a => {
            const hasBadge = (a.badge === 'phone' && missed > 0) ||
                             (a.badge === 'sms'   && unread > 0);
            return (
              <TouchableOpacity key={a.label} style={s.tile}
                onPress={() => navigate(a.screen)} activeOpacity={0.5}>
                <Text style={[s.label, { color: t.fg, fontSize: f + 2, textAlign: align }]}>
                  {a.label}{hasBadge ? ' *' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showToggles && (
          <View style={s.toggleCol}>
            <TouchableOpacity style={s.tog} onPress={tapAirplane} activeOpacity={0.6}>
              <Text style={[s.togLabel, { color: t.fg, fontSize: f - 4 }]}>PLANE</Text>
              <Text style={[s.togVal, { color: t.fg, fontSize: f - 3 },
                toggles.airplane && s.togOn]}>{toggles.airplane ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.tog} onPress={tapBluetooth} activeOpacity={0.6}>
              <Text style={[s.togLabel, { color: t.fg, fontSize: f - 4 }]}>BT</Text>
              <Text style={[s.togVal, { color: t.fg, fontSize: f - 3 },
                toggles.bluetooth && s.togOn]}>{toggles.bluetooth ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.tog} onPress={tapBrightness} activeOpacity={0.6}>
              <Text style={[s.togLabel, { color: t.fg, fontSize: f - 4 }]}>BRI</Text>
              <Text style={[s.togVal, { color: t.fg, fontSize: f - 3 }]}>
                {brightLabel(toggles.brightness)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.tog} onPress={tapGps} activeOpacity={0.6}>
              <Text style={[s.togLabel, { color: t.fg, fontSize: f - 4 }]}>GPS</Text>
              <Text style={[s.togVal, { color: t.fg, fontSize: f - 3 },
                toggles.gps && s.togOn]}>{toggles.gps ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 20 },
  clock:       { fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center' },
  statusRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 4 },
  statusLeft:  { flex: 1 },
  statusRight: { flexDirection: 'row', alignItems: 'center' },
  statusTxt:   { fontFamily: 'monospace', letterSpacing: 1 },
  bellBtn:     { marginLeft: 14, minHeight: 36, flexDirection: 'row', alignItems: 'center' },
  bellCount:   { marginLeft: 3, fontWeight: '700' },
  body:        { flex: 1, flexDirection: 'row', marginTop: 16 },
  appList:     { flex: 1 },
  tile:        { height: 54, justifyContent: 'center' },
  label:       { fontWeight: '700', letterSpacing: 2 },
  toggleCol:   { width: 52, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  tog:         { height: 54, alignItems: 'center', justifyContent: 'center' },
  togLabel:    { letterSpacing: 1, fontWeight: '700' },
  togVal:      { letterSpacing: 1, marginTop: 2 },
  togOn:       { fontWeight: '900' },
});
