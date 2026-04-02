import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, NativeModules } from 'react-native';

const NM = NativeModules.NotificationsModule || null;

const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'NOW';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'M';
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + (h >= 12 ? 'PM' : 'AM');
  }
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

export default function NotifScreen({ goBack, theme: t, fontSize = 15 }) {
  const [notifs, setNotifs]       = useState([]);
  const [hasPerm, setHasPerm]     = useState(true);
  const f = fontSize;

  const load = useCallback(() => {
    NM?.hasPermission().then(p => {
      setHasPerm(p);
      if (p) NM?.getNotifications().then(r => setNotifs(r || [])).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={goBack} style={s.backBtn}>
          <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: t.fg, fontSize: f + 2 }]}>NOTIFICATIONS</Text>
      </View>

      {!hasPerm ? (
        <View style={s.permBox}>
          <Text style={[s.permTxt, { color: t.fg, fontSize: f - 1 }]}>
            NOTIFICATION ACCESS REQUIRED{'\n'}
            ENABLE IN SETTINGS TO SEE NOTIFICATIONS
          </Text>
          <TouchableOpacity
            style={[s.permBtn, { borderColor: t.fg }]}
            onPress={() => NM?.openPermissionSettings().catch(() => {})}>
            <Text style={[s.permBtnTxt, { color: t.fg, fontSize: f - 1 }]}>OPEN SETTINGS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                {!!item.title && (
                  <Text style={[s.rowTitle, { color: t.fg, fontSize: f }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                )}
                {!!item.text && (
                  <Text style={[s.rowText, { color: t.fg, fontSize: f - 2 }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                )}
                <Text style={[s.rowPkg, { color: t.fg, fontSize: f - 4 }]} numberOfLines={1}>
                  {item.pkg}
                </Text>
              </View>
              <Text style={[s.rowTime, { color: t.fg, fontSize: f - 4 }]}>
                {fmtTime(item.time)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[s.empty, { color: t.fg, fontSize: f - 1 }]}>
              NO NOTIFICATIONS
            </Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  bar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
  backBtn:    { marginRight: 16, minHeight: 44, justifyContent: 'center' },
  backTxt:    { fontWeight: '700' },
  title:      { fontWeight: '700', letterSpacing: 2 },
  permBox:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permTxt:    { textAlign: 'center', lineHeight: 24, marginBottom: 24, letterSpacing: 1 },
  permBtn:    { borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  permBtnTxt: { fontWeight: '700', letterSpacing: 1 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, minHeight: 60 },
  rowTitle:   { fontWeight: '700', marginBottom: 2 },
  rowText:    { marginBottom: 2, lineHeight: 18 },
  rowPkg:     { letterSpacing: 1 },
  rowTime:    { marginLeft: 12, marginTop: 2, letterSpacing: 1 },
  empty:      { textAlign: 'center', marginTop: 60, letterSpacing: 1 },
});
