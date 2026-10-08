// The colour theme: which ones exist, where the choice is remembered on this
// device, and how it is applied to the page. The colours themselves are in
// src/theme.css.
//
// The account is the source of truth (User.theme on the backend). This
// device's copy exists so the right theme can be applied before the app has
// loaded, and on the sign-in pages where there is no account yet.

import { isNative } from '../services/api';

export const THEMES = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';

// Also read by public/theme-init.js, which applies the theme before first paint
const STORAGE_KEY = 'driveclique_theme';

/** The theme the page is showing now */
export const getTheme = () =>
  document.documentElement.dataset.theme === 'light' ? 'light' : DEFAULT_THEME;

/**
 * In the native app the page draws underneath the phone's status bar, so the
 * clock and battery icons have to contrast with the nav bar behind them.
 * (capacitor.config.ts starts them light-on-dark, which suits the default.)
 */
const syncNativeStatusBar = (theme) => {
  if (!isNative) return;
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) =>
      StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark }))
    .catch((err) => console.warn('Could not update the status bar for the theme:', err));
};

/**
 * Switch the page to `theme` and remember it on this device. Anything that
 * isn't a known theme falls back to the default, which covers a session
 * cached before accounts had a theme. Returns the theme that was applied.
 */
export const applyTheme = (theme) => {
  const next = THEMES.includes(theme) ? theme : DEFAULT_THEME;

  // Dark is the absence of the attribute, matching theme.css and theme-init.js
  if (next === DEFAULT_THEME) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (err) {
    // Storage is blocked: the theme still applies until the page is reloaded
    console.warn('Could not remember the theme on this device:', err);
  }

  syncNativeStatusBar(next);
  return next;
};

/** Call once at startup: theme-init.js has set the page, this covers the rest */
export const initTheme = () => syncNativeStatusBar(getTheme());
