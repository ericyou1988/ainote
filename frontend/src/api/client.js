import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const notesApi = {
  list: (params = {}) => client.get('/notes', { params }),
  get: (id) => client.get(`/notes/${id}`),
  create: (data) => client.post('/notes', data),
  update: (id, data) => client.put(`/notes/${id}`, data),
  remove: (id) => client.delete(`/notes/${id}`),
  export: (id, format = 'md') => client.get(`/notes/${id}/export`, { params: { format } }),
  analyze: (id) => fetch(`/api/notes/${id}/analyze`),
  getChat: (id) => client.get(`/notes/${id}/chat`),
  sendChat: (id, message) => fetch(`/api/notes/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }),
};

export const providersApi = {
  list: () => client.get('/providers'),
  create: (data) => client.post('/providers', data),
  update: (id, data) => client.put(`/providers/${id}`, data),
  remove: (id) => client.delete(`/providers/${id}`),
  toggle: (id) => client.put(`/providers/${id}/toggle`),
  setCurrent: (id) => client.put(`/providers/${id}/set-current`),
  test: (id) => client.post(`/providers/${id}/test`),
  testAll: () => client.post('/providers/test-all'),
};
