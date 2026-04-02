import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, NativeModules } from 'react-native';

const PM = NativeModules.PhoneModule || null;

const KEYPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']];
const TABS = ['DIAL','RECENT','CONTACTS'];

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours(), m = d.getMinutes();
    return (h%12||12) + ':' + (m<10?'0'+m:m) + (h>=12?'PM':'AM');
  }
  return ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()] + ' ' + d.getDate();
}

export default function PhoneScreen({ goBack, theme: t, fontSize = 15 }) {
  const [tab, setTab]       = useState(0);
  const [number, setNumber] = useState('');
  const [log, setLog]       = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const f = fontSize;

  useEffect(() => {
    PM?.getCallLog().then(r => setLog(r||[])).catch(()=>{});
    PM?.getContacts().then(r => setContacts(r||[])).catch(()=>{});
  }, []);

  const call = useCallback(() => {
    if (number.trim()) PM?.makeCall(number.trim());
  }, [number]);

  const pick = useCallback((num) => { setNumber(num); setTab(0); }, []);

  const filtered = search.trim()
    ? contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.number.includes(search))
    : contacts;

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {/* Bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={goBack} style={s.back}>
          <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: t.fg, fontSize: f+2 }]}>PHONE</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map((name, i) => (
          <TouchableOpacity key={name} style={s.tab} onPress={() => setTab(i)}>
            <Text style={[s.tabTxt, { color: t.fg, fontSize: f-1 },
              i===tab && { fontWeight:'700', textDecorationLine:'underline' }]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* DIAL */}
      {tab === 0 && (
        <View style={s.dial}>
          <View style={s.numRow}>
            <Text style={[s.numTxt, { color: t.fg, fontSize: f*2, fontFamily:'monospace' }]} numberOfLines={1}>
              {number || ' '}
            </Text>
            <TouchableOpacity onPress={() => setNumber(n => n.slice(0,-1))} style={s.del}>
              <Text style={[s.delTxt, { color: t.fg, fontSize: f }]}>DEL</Text>
            </TouchableOpacity>
          </View>
          {KEYPAD.map((row, ri) => (
            <View key={ri} style={s.kRow}>
              {row.map(k => (
                <TouchableOpacity key={k} style={s.key} onPress={() => setNumber(n=>n+k)} activeOpacity={0.6}>
                  <Text style={[s.keyTxt, { color: t.fg, fontSize: f+10 }]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity style={[s.callBtn, { backgroundColor: t.fg }]} onPress={call}>
            <Text style={[s.callTxt, { color: t.bg, fontSize: f+4 }]}>CALL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RECENT */}
      {tab === 1 && (
        <FlatList
          data={log}
          keyExtractor={(_,i) => String(i)}
          style={{ flex:1 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => pick(item.number)} activeOpacity={0.6}>
              <View style={s.rowTop}>
                <Text style={[s.rowName, { color: t.fg, fontSize: f }]} numberOfLines={1}>
                  {item.name || item.number}
                </Text>
                <Text style={[s.rowMeta, { color: t.fg, fontSize: f-3 }]}>
                  {item.type==='missed'?'MISSED':item.type==='in'?'IN':'OUT'}
                </Text>
              </View>
              <Text style={[s.rowSub, { color: t.fg, fontSize: f-3 }]}>
                {item.name ? item.number + '  ' : ''}{fmtDate(item.date)}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: t.fg, fontSize: f }]}>NO RECENT CALLS</Text>}
        />
      )}

      {/* CONTACTS */}
      {tab === 2 && (
        <View style={{ flex:1 }}>
          <View style={[s.searchRow, { borderBottomColor: t.fg }]}>
            <Text style={[s.searchIcon, { color: t.fg, fontSize: f }]}>
              {search || 'SEARCH...'}
            </Text>
          </View>
          {/* Tap to type search — use simple inline keyboard approach */}
          <View style={s.searchKeys}>
            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','⌫'].map(k => (
              <TouchableOpacity key={k} style={s.sk} onPress={() => {
                if (k==='⌫') setSearch(v=>v.slice(0,-1));
                else setSearch(v=>v+k);
              }}>
                <Text style={[s.skTxt, { color: t.fg, fontSize: f-3 }]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(_,i) => String(i)}
            style={{ flex:1 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.row} onPress={() => pick(item.number)} activeOpacity={0.6}>
                <Text style={[s.rowName, { color: t.fg, fontSize: f }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[s.rowSub, { color: t.fg, fontSize: f-3 }]}>{item.number}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[s.empty, { color: t.fg, fontSize: f }]}>NO CONTACTS</Text>}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex:1 },
  bar:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, minHeight:52 },
  back:     { marginRight:16, minHeight:48, justifyContent:'center' },
  backTxt:  { fontWeight:'700' },
  title:    { fontWeight:'700', letterSpacing:2 },
  tabRow:   { flexDirection:'row', paddingHorizontal:16, paddingBottom:10 },
  tab:      { marginRight:24, paddingVertical:8 },
  tabTxt:   { letterSpacing:2 },
  dial:     { flex:1, paddingHorizontal:20, paddingTop:8 },
  numRow:   { flexDirection:'row', alignItems:'center', marginBottom:16, minHeight:56 },
  numTxt:   { flex:1, letterSpacing:2 },
  del:      { paddingLeft:12, minHeight:48, justifyContent:'center' },
  delTxt:   { fontWeight:'700' },
  kRow:     { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  key:      { flex:1, height:68, justifyContent:'center', alignItems:'center', marginHorizontal:4 },
  keyTxt:   {},
  callBtn:  { height:68, justifyContent:'center', alignItems:'center', marginTop:8 },
  callTxt:  { fontWeight:'700', letterSpacing:2 },
  row:      { paddingHorizontal:20, paddingVertical:12, minHeight:56 },
  rowTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  rowName:  { fontWeight:'600', flex:1 },
  rowMeta:  { fontWeight:'700', marginLeft:8 },
  rowSub:   {  marginTop:2 },
  empty:    { textAlign:'center', marginTop:48,  },
  searchRow:{ paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1 },
  searchIcon:{  },
  searchKeys:{ flexDirection:'row', flexWrap:'wrap', paddingHorizontal:8, paddingVertical:6 },
  sk:       { width:'11%', height:36, justifyContent:'center', alignItems:'center', margin:1 },
  skTxt:    { fontWeight:'500' },
});
