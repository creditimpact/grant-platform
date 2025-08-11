import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.split('; ').find((row) => row.startsWith('csrfToken='));
    if (match && config.headers) {
      (config.headers as Record<string, string>)['X-CSRF-Token'] = match.split('=')[1];
    }
  }
  return config;
});

export default api;
