// frontend-next/lib/axios.js
import axios from 'axios';

// ====================================================================
// --- CONFIGURACIÓN CENTRALIZADA ---
// Aquí es donde definimos una instancia de Axios con configuraciones por defecto.
// ====================================================================

const api = axios.create({
  // URL base para todas las peticiones.
  // Se obtiene de las variables de entorno de Next.js
  baseURL: process.env.NEXT_PUBLIC_API_URL,

  // Esto es necesario para enviar cookies, tokens de sesión y credenciales
  // de autenticación con las peticiones.
  withCredentials: true,
});

// ====================================================================
// --- AÑADIR UN INTERCEPTOR ---
// Los interceptores nos permiten modificar las peticiones antes de que se envíen.
// Aquí, añadimos la cabecera 'ngrok-skip-browser-warning' a cada petición,
// lo que solucionará el problema con localtunnel.
// ====================================================================

api.interceptors.request.use(config => {
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
}, error => {
  return Promise.reject(error);
});

export default api;
