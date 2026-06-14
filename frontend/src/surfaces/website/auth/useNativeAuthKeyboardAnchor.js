import { useEffect } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { detectPlatform } from '../../../shared/platform/detect.js';

const PLATFORM = detectPlatform();

export function useNativeAuthKeyboardAnchor({ surface, wrapSelector, cardSelector }) {
  useEffect(() => {
    if (!PLATFORM.isNative || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const keyboardAttr = `data-lms-${surface}-keyboard`;
    const cardTopVar = `--lms-${surface}-card-top`;

    const syncCardTop = () => {
      const wrap = document.querySelector(wrapSelector);
      const card = document.querySelector(cardSelector);
      if (!wrap || !card) return;

      const wrapRect = wrap.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      root.style.setProperty(cardTopVar, `${Math.max(0, Math.round(cardRect.top - wrapRect.top))}px`);
    };

    const setKeyboardHeight = (px) => {
      const height = Math.max(0, Math.round(px));
      if (height > 0) {
        syncCardTop();
      } else {
        root.style.removeProperty(cardTopVar);
      }
      root.style.setProperty('--lms-keyboard-height', `${height}px`);
      root.setAttribute(keyboardAttr, height > 0 ? 'open' : 'closed');
    };

    const listeners = [];
    setKeyboardHeight(0);
    Keyboard.addListener('keyboardWillShow', (info) => setKeyboardHeight(info?.keyboardHeight || 0))
      .then((handle) => listeners.push(handle))
      .catch(() => {});
    Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0))
      .then((handle) => listeners.push(handle))
      .catch(() => {});

    return () => {
      listeners.forEach((handle) => handle?.remove?.());
      root.style.removeProperty('--lms-keyboard-height');
      root.style.removeProperty(cardTopVar);
      root.removeAttribute(keyboardAttr);
    };
  }, [cardSelector, surface, wrapSelector]);
}
