import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  withCredentials: true,
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      const here = window.location.pathname;
      if (!here.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(err);
  },
);
