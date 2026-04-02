import { NativeModules } from 'react-native';
const { ThemeModule } = NativeModules;

const lightTheme = { isDark: false, bg: '#FFFFFF', fg: '#000000', btnBg: '#000000', btnFg: '#FFFFFF' };
const darkTheme  = { isDark: true,  bg: '#000000', fg: '#FFFFFF', btnBg: '#FFFFFF', btnFg: '#000000' };

let currentTheme = lightTheme;
const listeners = new Set();

function notify() { listeners.forEach(fn => fn(currentTheme)); }

const theme = {
  get isDark()  { return currentTheme.isDark; },
  get bg()      { return currentTheme.bg; },
  get fg()      { return currentTheme.fg; },
  get btnBg()   { return currentTheme.btnBg; },
  get btnFg()   { return currentTheme.btnFg; },
  get current() { return currentTheme; },

  async load() {
    try {
      const dark = await ThemeModule.isDark();
      currentTheme = dark ? darkTheme : lightTheme;
    } catch (e) {
      currentTheme = lightTheme;
    }
    notify();
    return currentTheme;
  },

  async toggle() {
    currentTheme = currentTheme.isDark ? lightTheme : darkTheme;
    try { await ThemeModule.setDark(currentTheme.isDark); } catch (e) {}
    notify();
    return currentTheme;
  },

  subscribe(fn)   { listeners.add(fn); },
  unsubscribe(fn) { listeners.delete(fn); },
};

export default theme;
