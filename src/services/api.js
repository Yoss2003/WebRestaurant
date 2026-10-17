import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD) {
    if (!API_BASE_URL || API_BASE_URL.includes('192.168') || API_BASE_URL.includes('localhost')) {
        console.error("ERROR CRÍTICO: URL de API inválida para producción. Forzando dominio de producción...");
        API_BASE_URL = 'https://api.tu-restaurante-real.com/api'; 
    }
} else {
    if (!API_BASE_URL) {
        API_BASE_URL = 'http://192.168.1.16:5065/api';
    }
}

API_BASE_URL = API_BASE_URL.trim();

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
            const isAbsoluteExternal = config.url.startsWith('http://') || config.url.startsWith('https://') || config.url.startsWith('//');
            
            if (isAbsoluteExternal) {
                if (config.url.startsWith(API_BASE_URL)) {
                    config.headers.Authorization = `Bearer ${tableToken}`;
                }
            } else {
                config.headers.Authorization = `Bearer ${tableToken}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;