import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

export default api;
