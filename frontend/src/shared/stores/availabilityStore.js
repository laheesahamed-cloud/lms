import { create } from 'zustand';
import { fetchPublicAvailabilitySettings } from '../api/settings.api.js';

const DEFAULT_AVAILABILITY = {
  mode: 'live',
  isLive: true,
  isMaintenance: false,
  isComingSoon: false,
  scope: 'none',
};

function normalizeMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

  return ['live', 'maintenance', 'coming-soon'].includes(mode) ? mode : 'live';
}

function normalizeAvailability(input) {
  const raw = input?.availability || input || {};
  const mode = normalizeMode(raw.mode);

  return {
    mode,
    isLive: mode === 'live',
    isMaintenance: mode === 'maintenance',
    isComingSoon: mode === 'coming-soon',
    scope: mode === 'maintenance' ? 'all' : mode === 'coming-soon' ? 'website' : 'none',
  };
}

let hydrationPromise = null;

export const useAvailabilityStore = create((set, get) => ({
  availability: DEFAULT_AVAILABILITY,
  hydrated: false,
  loading: false,
  error: '',

  hydrate: async ({ force = false } = {}) => {
    if (!force && get().hydrated) {
      return get().availability;
    }

    if (hydrationPromise && !force) {
      return hydrationPromise;
    }

    set({ loading: true, error: '' });
    hydrationPromise = fetchPublicAvailabilitySettings()
      .then((settings) => {
        const availability = normalizeAvailability(settings);
        set({ availability, hydrated: true, loading: false, error: '' });
        return availability;
      })
      .catch((error) => {
        set({
          availability: DEFAULT_AVAILABILITY,
          hydrated: true,
          loading: false,
          error: error?.message || 'Unable to load availability settings',
        });
        return DEFAULT_AVAILABILITY;
      })
      .finally(() => {
        hydrationPromise = null;
      });

    return hydrationPromise;
  },

  setAvailability: (settings) => {
    set({
      availability: normalizeAvailability(settings),
      hydrated: true,
      loading: false,
      error: '',
    });
  },
}));
