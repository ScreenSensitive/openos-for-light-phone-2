import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeModules } from 'react-native';

const AL = NativeModules.AppLauncherModule || null;

export default function AppsScreen({ goBack, theme: t, fontSize = 15 }) {
  const [apps, setApps]   = useState([]);
  const [page, setPage]   = useState(0);
  const f = fontSize;
  const PER_PAGE = 9;

  useEffect(() => {
    AL?.getInstalledApps()
      .then(list => setApps(list || []))
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(apps.length / PER_PAGE));
  const slice = apps.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const prev = useCallback(() => setPage(p => Math.max(0, p - 1)), []);
  const next = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [totalPages]);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={goBack} style={s.backBtn}>
          <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: t.fg, fontSize: f + 2 }]}>APPS</Text>
      </View>

      {/* App list for current page */}
      <View style={s.list}>
        {slice.map(app => (
          <TouchableOpacity
            key={app.package}
            style={s.row}
            onPress={() => AL?.launchApp(app.package)}
            onLongPress={() => AL?.openAppInfo(app.package)}
            activeOpacity={0.5}
            delayLongPress={500}
          >
            <Text style={[s.appName, { color: t.fg, fontSize: f + 1 }]} numberOfLines={1}>
              {app.name}
            </Text>
          </TouchableOpacity>
        ))}
        {apps.length === 0 && (
          <Text style={[s.empty, { color: t.fg, fontSize: f }]}>LOADING...</Text>
        )}
      </View>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={s.pager}>
          <TouchableOpacity style={s.pageBtn} onPress={prev} disabled={page === 0}>
            <Text style={[s.pageTxt, { color: t.fg, fontSize: f }, page === 0 && s.dim]}>PREV</Text>
          </TouchableOpacity>
          <Text style={[s.pageNum, { color: t.fg, fontSize: f - 2 }]}>
            {page + 1} / {totalPages}
          </Text>
          <TouchableOpacity style={s.pageBtn} onPress={next} disabled={page === totalPages - 1}>
            <Text style={[s.pageTxt, { color: t.fg, fontSize: f }, page === totalPages - 1 && s.dim]}>NEXT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  bar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
  backBtn: { marginRight: 16, minHeight: 44, justifyContent: 'center' },
  backTxt: { fontWeight: '700' },
  title:   { fontWeight: '700', letterSpacing: 2 },
  list:    { flex: 1, paddingHorizontal: 28, paddingTop: 8 },
  row:     { flex: 1, justifyContent: 'center', paddingVertical: 4 },
  appName: { fontWeight: '600', letterSpacing: 1 },
  empty:   { textAlign: 'center', marginTop: 48 },
  pager:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, minHeight: 56 },
  pageBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  pageTxt: { fontWeight: '700', letterSpacing: 1 },
  pageNum: { letterSpacing: 1 },
  dim:     { opacity: 0 }, // invisible but keeps layout
});
