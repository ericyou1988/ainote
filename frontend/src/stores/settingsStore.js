import { create } from 'zustand';
import { providersApi } from '../api/client';

export const useSettingsStore = create((set) => ({
  providers: [],
  currentProvider: null,

  fetchProviders: async () => {
    const { data } = await providersApi.list();
    set({ providers: data });
    const current = data.find(p => p.is_current);
    set({ currentProvider: current || null });
  },
}));
