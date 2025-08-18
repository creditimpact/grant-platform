import { create } from 'zustand';
import api from '@/lib/api';
import { safeWarn } from '@/utils/logger';

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
    await api.post('/auth/login', { email, password });
    await useAuth.getState().check();
    set({ loading: false });
  },

  async register(data) {
    set({ loading: true });
    await api.post('/auth/register', data);
    await useAuth.getState().check();
    set({ loading: false });
  },

  async logout() {
    await api.post('/auth/logout');
    set({ user: null });
  },

  async check() {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data });
    } catch (err) {
      safeWarn('Auth check failed', err);
      set({ user: null });
    }
  },
}));
