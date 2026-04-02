# OpenOS

A minimal open-source launcher for the **Light Phone 2** built with React Native. Replaces LightOS with a fully open, hackable alternative — 

> **Root required** for direct EPD (eink display) control via sysfs. The app works without root but display refresh quality degrades — updates fall back to Android's default behavior.

---

## Features

### Home Screen
- Large monospace clock (HH:MM)
- Day / date / battery status bar (toggleable)
- Quick toggle bar: brightness steps (Auto / Off / 25 / 50 / 75 / 100%) — toggleable
- Notification bell indicator — toggleable
- App grid: Phone, Messages, Music, Apps, Settings
- Left / center / right alignment option

### Phone
- Full numeric keypad dialer
- Call log (Recents tab) with incoming ↓ / outgoing ↑ / missed ✕ indicators
- Contacts list with live search
- Tap any recent or contact to pre-fill the dialer
- Falls back to `ACTION_DIAL` if `CALL` permission is denied

### Messages (SMS)
- Thread list with unread count
- Conversation view with sent/received bubble layout
- New message compose
- Built-in eink keyboard (optional — can switch to system keyboard)
- Keyboard vibration: Off / Low / Med / High
- Live relative timestamps (NOW / 5M / 10:30AM / JAN 5)

### Music
- YouTube search via NewPipe extractor (no YouTube API key needed)
- YouTube Music source option
- Stream quality: Low / Med / High
- Saved / favorited tracks list
- Now playing bar with play/pause, prev/next queue controls
- Heart / unlike with confirmation dialog
- Built-in eink keyboard for search

### Apps
- Lists all installed user apps
- Paginated 9-per-page grid
- Tap to launch

### Notifications
- Reads system notifications via `NotificationListenerService`
- Auto-refreshes every 5 seconds
- Relative timestamps

### Settings

**Display**
- Dark / Light theme toggle
- Font size: 12–22sp (A- / A+ buttons)
- Date & battery status bar toggle
- System status bar hide/show (root)
- Navigation bar hide/show (root)
- Quick toggles bar toggle
- Notification bell toggle
- Home screen alignment: Left / Center / Right

**Keyboard**
- Built-in eink-optimized keyboard vs system keyboard
- Vibrate strength: Off / Low / Med / High

**EPD / Eink (root)**
- Waveform mode selector:
  - `A2` — binary, fastest, no flash (best for rapid keypresses)
  - `DU` — direct update, fast, no flash (default scrolling mode)
  - `GL16` — greyscale, richer rendering
  - `GC16` — full ghost compensation, clearest (screen transitions)
- Ghost counter: auto-fires a GC16 full refresh every 6 scroll events to clear ghosting
- All EPD writes go directly to `/sys/devices/virtual/graphics/fb0/` sysfs — same sequence as LightOS (bugged)

---

## EPD / Eink Details

OpenOS attemps to mirror LightOS's eink refresh sequence:

| Event | Sequence |
|---|---|
| Screen transition | `full_update_en=1` → `wf_mode=GC16` → `Bflash=0` |
| Scroll (DU) | `os_mode=1` → `partial_update_en=1` → region coords → `partial_wf_mode=2` → `Bflash=0` |
| Ghost threshold (every 6 scrolls) | Full GC16 to clear accumulated ghosting |

Rate limits: max 1 full update per 200ms, min 50ms between partial updates.

Without root, sysfs writes fail silently and Android handles display refresh normally.

---

## Requirements

- Light Phone 2
- Root (Magisk recommended) for EPD sysfs control
---

## Building

```bash
git clone https://github.com/YOUR_USERNAME/openos
cd openos
npm install
npx react-native run-android
```

Release APK:
```bash
cd android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

---


## Architecture

```
src/
  App.js                  — root navigator, global state, theme
  eink.js                 — EPD sysfs wrapper, scroll hook, Eink wrapper component
  keyboard.js             — built-in eink-optimized on-screen keyboard
  theme.js                — dark/light color tokens
  screens/
    HomeScreen.js         — clock, app grid, quick toggles
    PhoneScreen.js        — dialer, recents, contacts
    SmsScreen.js          — thread list, conversation view, compose
    MusicScreen.js        — YouTube search, now playing, saved tracks
    AppsScreen.js         — installed app launcher
    NotifScreen.js        — system notification reader
    SettingsScreen.js     — all settings
```

**Native modules (Android):**

| Module | Purpose |
|---|---|
| `EpdModule` | Direct sysfs EPD writes for eink control |
| `PhoneModule` | Call log, contacts, make/receive calls |
| `SmsModule` | SMS threads, messages, send |
| `MusicModule` | NewPipe-based YouTube audio streaming |
| `ThemeModule` | Status/nav bar visibility, theme persistence |
| `NotificationsModule` | System notification listener |
| `AppLauncherModule` | Installed app list + launch |
| `QuickTogglesModule` | Brightness, wifi, bluetooth toggles |

---

## Contributing

PRs welcome. Areas that need work:
EVERYTHING lol

---

## License

MIT
