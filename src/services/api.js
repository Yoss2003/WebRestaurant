import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://192.168.1.16:5065/api').trim();

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(
    (config) => {
        const tableToken = typeof window !== 'undefined' ? sessionStorage.getItem('tableSessionToken') : null;
        if (tableToken && config.url) {
            const isRelativePath = !/^https?:\/\//i.test(config.url);
            const isSameOrigin = config.url.startsWith(API_BASE_URL);

            if (isRelativePath || isSameOrigin) {
                config.headers.Authorization = `Bearer ${tableToken}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;