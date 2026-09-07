// Central place for the mobile app's store links.
//
// Both the "Open in the App" content gate (shared/ui/AppOnlyGate.jsx) and the
// landing page download badges (surfaces/website/components/landing/FinalCTA.jsx,
// SiteFooter.jsx) read from here. Once the app is published, paste the real
// URLs in below — every surface that offers a download goes live at once.
export const APP_STORE_URL = null; // e.g. 'https://apps.apple.com/app/id0000000000'
export const PLAY_STORE_URL = null; // e.g. 'https://play.google.com/store/apps/details?id=app.xyndrome.lk'

export function hasAppStoreLink() {
  return Boolean(APP_STORE_URL);
}

export function hasPlayStoreLink() {
  return Boolean(PLAY_STORE_URL);
}
