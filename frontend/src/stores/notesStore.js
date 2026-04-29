import { create } from 'zustand';
import { notesApi } from '../api/client';

export const useNotesStore = create((set, get) => ({
  notes: [],
  total: 0,
  loading: false,
  currentNote: null,

  fetchNotes: async (params = {}) => {
    set({ loading: true });
    try {
      const { data } = await notesApi.list(params);
      set({ notes: data.notes, total: data.total });
    } finally {
      set({ loading: false });
    }
  },

  fetchNote: async (id) => {
    const { data } = await notesApi.get(id);
    set({ currentNote: data });
    return data;
  },

  createNote: async (data) => {
    const { data: note } = await notesApi.create(data);
    get().fetchNotes();
    return note;
  },

  updateNote: async (id, data) => {
    const { data: note } = await notesApi.update(id, data);
    get().fetchNotes();
    return note;
  },

  deleteNote: async (id) => {
    await notesApi.remove(id);
    get().fetchNotes();
  },
}));
