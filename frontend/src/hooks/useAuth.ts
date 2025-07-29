import { create } from 'zustand';
import axios from 'axios'; // ✅ תיקון: הייבוא שהיה חסר
import api from '@/lib/api';

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
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', res.data.token);
    }
    await useAuth.getState().check();
    set({ loading: false });
  },
  async register(data) {
    set({ loading: true });
    const res = await api.post('/register', data);
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', res.data.token);
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
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },
}));
