const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  baseURL: API_URL,
  
  // Endpoints
  auth: {
    login: `${API_URL}/api/auth/login`,
    register: `${API_URL}/api/auth/register`,
    me: `${API_URL}/api/auth/me`,
    logout: `${API_URL}/api/auth/logout`,
  },
  
  posts: {
    getAll: `${API_URL}/api/posts`,
    create: `${API_URL}/api/posts`,
    update: (id: string) => `${API_URL}/api/posts/${id}`,
    delete: (id: string) => `${API_URL}/api/posts/${id}`,
  },
  
  // Función helper para fetch con credenciales
  fetch: async (endpoint: string, options: RequestInit = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
};