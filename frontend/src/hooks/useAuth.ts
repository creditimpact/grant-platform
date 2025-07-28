import { create } from 'zustand';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

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
    await api.post('/login', { email, password });
    set({ loading: false });
  },
  async register(data) {
    set({ loading: true });
    await api.post('/register', data);
    set({ loading: false });
  },
  async logout() {
    await api.post('/logout');
    set({ user: null });
  },
  async check() {
    try {
      const res = await api.get('/me');
      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },
}));
