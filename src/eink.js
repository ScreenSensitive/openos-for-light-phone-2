import React, { useEffect, useRef, useCallback } from 'react';
import { NativeModules } from 'react-native';

const EPD = NativeModules.EpdModule || null;

export const MODE_A2   = 1;
export const MODE_DU   = 2;
export const MODE_GL16 = 3;
export const MODE_GC16 = 4;

let lastFullUpdateMs = 0;

export function initEpd() {
  if (!EPD) return;
  EPD.init().catch(() => {});
}

export function doFullUpdate(mode = MODE_GC16) {
  if (!EPD) return;
  const now = Date.now();
  if (now - lastFullUpdateMs < 200) return;  // rate-limit: max 1 full update per 200ms
  lastFullUpdateMs = now;
  EPD.fullUpdate(mode, 0).catch(() => {});
}

// Wraps a screen — fires one GC16 on mount only
export function Eink({ children }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      doFullUpdate(MODE_GC16);
    }
  }, []);
  return children;
}

export function useScrollEpd() {
  const ghostCount = useRef(0);
  const lastTs = useRef(0);

  const onScroll = useCallback(() => {
    if (!EPD) return;
    const now = Date.now();
    if (now - lastTs.current < 50) return;
    lastTs.current = now;

    ghostCount.current += 1;
    if (ghostCount.current >= 6) {
      ghostCount.current = 0;
      doFullUpdate(MODE_GC16);
      return;
    }
    EPD.partialUpdate(0, 0, 1080, 1920, MODE_DU).catch(() => {});
  }, []);

  return onScroll;
}
