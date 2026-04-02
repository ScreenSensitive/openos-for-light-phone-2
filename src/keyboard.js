import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';

const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['⇧','z','x','c','v','b','n','m','⌫'],
  ['123','SPACE','.','↵'],
];

const NUM_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['-','/',':', ';','(',')','$','&','@','"'],
  ['#+=','.', ',','?','!','\'','⌫'],
  ['ABC','SPACE','↵'],
];

// vibrateStrength: 0=off, 1=low(15ms), 2=medium(35ms), 3=high(65ms)
const VIBRATE_MS = [0, 15, 35, 65];

export default function Keyboard({ value = '', onChange, onSubmit, theme: t, fontSize = 14, vibrateStrength = 0 }) {
  const [caps, setCaps]   = React.useState(false);
  const [numMode, setNum] = React.useState(false);

  const press = useCallback((key) => {
    const ms = VIBRATE_MS[vibrateStrength] || 0;
    if (ms > 0) Vibration.vibrate(ms);
    if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === '↵') {
      onSubmit?.();
    } else if (key === '⇧') {
      setCaps(c => !c);
    } else if (key === '123') {
      setNum(true);
    } else if (key === 'ABC') {
      setNum(false);
    } else if (key === 'SPACE') {
      onChange(value + ' ');
    } else {
      const ch = (!numMode && caps) ? key.toUpperCase() : key;
      onChange(value + ch);
      if (!numMode && caps) setCaps(false);
    }
  }, [value, onChange, onSubmit, caps, numMode, vibrateStrength]);

  const rows = numMode ? NUM_ROWS : ROWS;

  return (
    <View style={[s.kb, { backgroundColor: t.bg }]}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((key) => {
            const display = (!numMode && caps && key.length === 1) ? key.toUpperCase() : key;
            const isSpace  = key === 'SPACE';
            const isAction = ['⌫','↵','⇧','123','ABC','#+='].includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[s.key, isSpace && s.spaceKey, isAction && { backgroundColor: t.fg }]}
                onPress={() => press(key)}
                activeOpacity={0.5}
              >
                <Text style={[s.keyTxt, { color: t.fg, fontSize: fontSize - 1 }, isAction && { color: t.bg }]}>
                  {isSpace ? 'SPACE' : display}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kb:       { paddingHorizontal: 4, paddingVertical: 4 },
  row:      { flexDirection: 'row', justifyContent: 'center', marginBottom: 3 },
  key:      { minWidth: 34, height: 46, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2, paddingHorizontal: 4 },
  spaceKey: { flex: 1, marginHorizontal: 4 },
  keyTxt:   { fontWeight: '600' },
});
