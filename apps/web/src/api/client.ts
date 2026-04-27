import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  withCredentials: true,
  timeout: 15_000,
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const PUBLIC_AUTH_PATHS = new Set([
  '/_auth/session',
  '/_auth/refresh',
  '/_auth/login',
  '/_auth/register',
  '/_auth/logout',
]);

function isPublicAuthPath(url?: string): boolean {
  if (!url) return false;
  for (const p of PUBLIC_AUTH_PATHS) {
    if (url.endsWith(p)) return true;
  }
  return false;
}

let refreshInflight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInflight) {
    refreshInflight = apiClient
      .post('/_auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshInflight = null;
      });
  }
  return refreshInflight;
}

apiClient.interceptors.response.use(
  (resp) => resp,
  async (err: AxiosError) => {
    const cfg = err.config as RetriableConfig | undefined;
    const status = err.response?.status;

    if (status === 401 && cfg && !cfg._retry && !isPublicAuthPath(cfg.url)) {
      cfg._retry = true;
      const ok = await tryRefresh();
      if (ok) return apiClient.request(cfg);

      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(err);
  },
);
