import axios, { AxiosError } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  withCredentials: true,
  timeout: 15_000,
});

interface ApiErrorBody {
  ok?: boolean;
  error?: { code?: string; message?: string };
}

apiClient.interceptors.response.use(
  (resp) => resp,
  (err: AxiosError<ApiErrorBody>) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      const here = window.location.pathname;
      if (!here.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
    // Trích app-level error code/message từ body để view code không cần
    // unwrap qua err.response.data.error.code thủ công.
    const body = err?.response?.data;
    const appCode = body?.error?.code;
    const appMessage = body?.error?.message;
    if (appCode) {
      (err as AxiosError & { code?: string }).code = appCode;
    }
    if (appMessage) {
      err.message = appMessage;
    }
    return Promise.reject(err);
  },
);
