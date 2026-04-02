import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, NativeModules, TextInput } from 'react-native';
import Keyboard from '../keyboard';

const SM = NativeModules.SmsModule || null;

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'NOW';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'M';
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + (h >= 12 ? 'PM' : 'AM');
  }
  const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return mo[d.getMonth()] + ' ' + d.getDate();
}

export default function SmsScreen({ goBack, theme: t, fontSize = 15, useBuiltinKeyboard = true, vibrateStrength = 0 }) {
  const [view, setView]         = useState('threads'); // 'threads' | 'convo' | 'new'
  const [threads, setThreads]   = useState([]);
  const [convo, setConvo]       = useState(null);   // { threadId, address, name }
  const [messages, setMessages] = useState([]);
  const [body, setBody]         = useState('');
  const [toAddr, setToAddr]     = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    loadThreads();
  }, []);

  function loadThreads() {
    SM?.getThreads()
      .then(r => setThreads(r || []))
      .catch(() => {});
  }

  function openConvo(thread) {
    setConvo(thread);
    setMessages([]);
    setBody('');
    setView('convo');
    SM?.getMessages(String(thread.threadId))
      .then(r => setMessages(r || []))
      .catch(() => {});
  }

  function send() {
    const address = view === 'new' ? toAddr.trim() : convo?.address;
    if (!address || !body.trim()) return;
    const txt = body.trim();
    setBody('');
    SM?.sendSms(address, txt)
      .then(() => {
        if (view === 'convo') {
          setMessages(prev => [...prev, { id: Date.now(), body: txt, type: 'sent', date: Date.now() }]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        } else {
          setView('threads');
          loadThreads();
        }
      })
      .catch(() => {});
  }

  const f = fontSize;

  // ── Threads list ─────────────────────────────────────────────────────────────
  if (view === 'threads') {
    return (
      <View style={[s.root, { backgroundColor: t.bg }]}>
        <View style={s.bar}>
          {goBack && (
            <TouchableOpacity onPress={goBack} style={s.back}>
              <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.barTitle, { color: t.fg, fontSize: f + 2 }]}>MESSAGES</Text>
          <TouchableOpacity onPress={() => { setToAddr(''); setBody(''); setView('new'); }} style={s.compose}>
            <Text style={[s.composeTxt, { color: t.fg, fontSize: f + 4 }]}>+</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={threads}
          keyExtractor={item => String(item.threadId)}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.threadRow} onPress={() => openConvo(item)} activeOpacity={0.6}>
              <View style={s.threadTop}>
                <Text style={[s.threadName, { color: t.fg, fontSize: f },
                  item.unreadCount > 0 && { fontWeight: '700' }]} numberOfLines={1}>
                  {item.name || item.address}
                </Text>
                <Text style={[s.threadDate, { color: t.fg, fontSize: f - 3 }]}>
                  {fmtDate(item.date)}
                </Text>
              </View>
              <Text style={[s.threadSnippet, { color: t.fg, fontSize: f - 2 }]} numberOfLines={1}>
                {item.unreadCount > 0 ? `(${item.unreadCount}) ` : ''}{item.snippet}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: t.fg, fontSize: f }]}>NO MESSAGES</Text>}
        />
      </View>
    );
  }

  // ── New message ───────────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <View style={[s.root, { backgroundColor: t.bg }]}>
        <View style={s.bar}>
          <TouchableOpacity onPress={() => setView('threads')} style={s.back}>
            <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
          </TouchableOpacity>
          <Text style={[s.barTitle, { color: t.fg, fontSize: f + 2 }]}>NEW MESSAGE</Text>
        </View>
        <View style={[s.toRow, { borderBottomColor: t.fg }]}>
          <Text style={[s.toLabel, { color: t.fg, fontSize: f }]}>TO  </Text>
          <Text style={[s.toValue, { color: t.fg, fontSize: f }]}>{toAddr || ' '}</Text>
        </View>
        <View style={[s.bodyDisplay, { borderBottomColor: t.fg }]}>
          <Text style={[s.bodyTxt, { color: t.fg, fontSize: f }]}>{body || ' '}</Text>
        </View>
        <TouchableOpacity style={[s.sendBtn, { backgroundColor: t.fg }]} onPress={send}>
          <Text style={[s.sendTxt, { color: t.bg, fontSize: f }]}>SEND</Text>
        </TouchableOpacity>
        {useBuiltinKeyboard ? (
          <Keyboard
            value={toAddr.length === 0 || body.length > 0 ? body : toAddr}
            onChange={(v) => { if (toAddr.length === 0) setToAddr(v); else setBody(v); }}
            onSubmit={send}
            theme={t}
            fontSize={f}
          />
        ) : (
          <TextInput
            style={[{ color: t.fg, fontSize: f, borderTopWidth: 1, borderTopColor: t.fg, padding: 8, minHeight: 44 }]}
            placeholder="Message..."
            placeholderTextColor={t.fg}
            value={body}
            onChangeText={setBody}
            onSubmitEditing={send}
            autoFocus
            multiline
          />
        )}
      </View>
    );
  }

  // ── Conversation ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <View style={s.bar}>
        <TouchableOpacity onPress={() => setView('threads')} style={s.back}>
          <Text style={[s.backTxt, { color: t.fg, fontSize: f }]}>BACK</Text>
        </TouchableOpacity>
        <Text style={[s.barTitle, { color: t.fg, fontSize: f + 2 }]} numberOfLines={1}>
          {convo?.name || convo?.address}
        </Text>
      </View>
      <ScrollView
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.msgList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map(msg => (
          <View key={String(msg.id)} style={[
            s.bubble,
            msg.type === 'sent' ? s.bubbleSent : s.bubbleRecv,
            msg.type === 'sent' ? { backgroundColor: t.fg } : {},
          ]}>
            <Text style={[s.bubbleTxt, { fontSize: f - 1 },
              msg.type === 'sent' ? { color: t.bg } : { color: t.fg }]}>
              {msg.body}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* Compose area */}
      <View style={[s.composArea, { borderTopColor: t.fg }]}>
        <View style={s.composeRow}>
          <Text style={[s.bodyTxt, { color: t.fg, fontSize: f, flex: 1 }]} numberOfLines={3}>
            {body || ' '}
          </Text>
          <TouchableOpacity style={[s.sendBtnInline, { backgroundColor: t.fg }]} onPress={send}>
            <Text style={[s.sendTxt, { color: t.bg, fontSize: f - 1 }]}>SEND</Text>
          </TouchableOpacity>
        </View>
        {useBuiltinKeyboard ? (
          <Keyboard value={body} onChange={setBody} onSubmit={send} theme={t} fontSize={f} vibrateStrength={vibrateStrength} />
        ) : (
          <TextInput
            style={[{ color: t.fg, fontSize: f, borderTopWidth: 1, borderTopColor: t.fg, padding: 8, minHeight: 44 }]}
            placeholder="Message..."
            placeholderTextColor={t.fg}
            value={body}
            onChangeText={setBody}
            onSubmitEditing={send}
            autoFocus
            multiline
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  bar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  back:         { marginRight: 16, minHeight: 48, justifyContent: 'center' },
  backTxt:      { fontWeight: '700' },
  barTitle:     { flex: 1, fontWeight: '700', letterSpacing: 1 },
  compose:      { minWidth: 44, height: 48, justifyContent: 'center', alignItems: 'center' },
  composeTxt:   { fontWeight: '300' },
  threadRow:    { paddingHorizontal: 20, paddingVertical: 14, minHeight: 64 },
  threadTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  threadName:   {},
  threadDate:   {  },
  threadSnippet:{  },
  empty:        { textAlign: 'center', marginTop: 60,  },
  toRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  toLabel:      { fontWeight: '700',  },
  toValue:      {},
  bodyDisplay:  { paddingHorizontal: 20, paddingVertical: 14, minHeight: 80, borderBottomWidth: 1 },
  bodyTxt:      {},
  sendBtn:      { margin: 16, height: 52, justifyContent: 'center', alignItems: 'center' },
  sendTxt:      { fontWeight: '700', letterSpacing: 2 },
  msgList:      { padding: 16, paddingBottom: 8 },
  bubble:       { maxWidth: '80%', padding: 12, marginBottom: 8 },
  bubbleSent:   { alignSelf: 'flex-end' },
  bubbleRecv:   { alignSelf: 'flex-start' },
  bubbleTxt:    {},
  composArea:   { borderTopWidth: 1 },
  composeRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  sendBtnInline:{ height: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});
