import { create } from 'zustand';
import api from '@/lib/api'; // ← Axios instance עם baseURL מוגדר

interface AuthState {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,

  async login(email, password) {
    set({ loading: true });
    const res = await api.post('/login', { email, password });

    const token = res.data.token;
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('token', token);
    }

    await useAuth.getState().check();
    set({ loading: false });
  },

  async register(data) {
    set({ loading: true });
    const res = await api.post('/register', data);

    const token = res.data.token;
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('token', token);
    }

    await useAuth.getState().check();
    set({ loading: false });
  },

  async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    set({ user: null });
  },

  async check() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        set({ user: null });
        return;
      }

      const res = await api.get('/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      set({ user: res.data });
    } catch (err) {
      console.warn('Auth check failed:', err);
      set({ user: null });
    }
  },
}));
