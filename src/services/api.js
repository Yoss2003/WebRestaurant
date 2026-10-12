import axios from 'axios';

// Instancia principal apuntando a tu backend de .NET
const api = axios.create({
    baseURL: 'https://localhost:7064/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para inyectar el token JWT en las peticiones que lo requieran
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

export default api;