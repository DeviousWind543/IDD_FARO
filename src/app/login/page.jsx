// frontend-next/src/app/login/page.jsx
'use client'; // Indica que este componente es un Client Component en Next.js App Router

import { useState } from 'react'; // Hook para manejar el estado del componente
import axios from '@/lib/axios'; // Cliente HTTP para hacer peticiones al backend
import { useRouter } from 'next/navigation'; // Hook de Next.js para la navegación programática

// --- CONFIGURACIÓN DE LA URL DE LA API ---
// Obtiene la URL base de la API del backend desde las variables de entorno de Next.js.
// `NEXT_PUBLIC_API_URL` debe estar definida en un archivo .env.local en la raíz del proyecto frontend.
// Si no está definida, usa 'http://localhost:3001/api' como fallback.
// ¡Importante!: Si el backend no está en 'localhost', asegúrate de que NEXT_PUBLIC_API_URL
// apunte a la IP y puerto correctos de tu backend (ej. 'http://192.168.100.16:3001/api').
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * @function LoginPage
 * @description Componente de página para el inicio de sesión de usuarios.
 */
export default function LoginPage() {
    const router = useRouter(); // Instancia del enrutador para redirecciones
    // Estado para los datos del formulario de email y contraseña
    const [form, setForm] = useState({ email: '', password: '' });
    // Estado para mostrar mensajes de error al usuario
    const [error, setError] = useState('');
    // Estado para controlar el estado de carga del botón de login
    const [loading, setLoading] = useState(false);

    /**
     * @function handleChange
     * @description Maneja los cambios en los inputs del formulario y actualiza el estado `form`.
     * @param {object} e - Evento de cambio del input.
     */
    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    /**
     * @function handleSubmit
     * @description Maneja el envío del formulario de inicio de sesión.
     * Realiza una petición POST al backend para autenticar al usuario.
     * @param {object} e - Evento de envío del formulario.
     */
    const handleSubmit = async e => {
        e.preventDefault(); // Previene el comportamiento por defecto del formulario (recarga de página)
        setError(''); // Limpia cualquier error anterior
        setLoading(true); // Activa el estado de carga

        try {
            // Realiza la petición POST al endpoint de login del backend
            // La URL completa será algo como 'http://192.168.100.16:3001/api/auth/login'
            const res = await axios.post(`${API_BASE_URL}/auth/login`, form);

            // Extrae el token JWT y los datos del usuario de la respuesta
            const { token, user } = res.data;

            // Asegura que el código se ejecute solo en el entorno del navegador (cliente)
            if (typeof window !== 'undefined') {
                // Almacena el token JWT y los datos del usuario en localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('userId', user.id);
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userEmail', user.email);

                // Determina el rol del usuario en un formato de string legible y lo guarda
                let roleString;
                switch (user.role_id) {
                    case 1:
                        roleString = 'admin';
                        break;
                    case 2:
                        roleString = 'teacher';
                        break;
                    case 3:
                        roleString = 'student'; // O el nombre que uses para otros usuarios
                        break;
                    default:
                        roleString = 'student'; // Por defecto si el rol no es reconocido
                }
                localStorage.setItem('userRole', roleString); // Guardar como 'admin', 'teacher', 'student'

                // Almacena el ID del grupo de clase si existe, de lo contrario lo elimina
                if (user.class_group_id) {
                    localStorage.setItem('userClassGroupId', user.class_group_id);
                } else {
                    localStorage.removeItem('userClassGroupId');
                }
            }

            // Redirige al usuario al dashboard después de un inicio de sesión exitoso
            router.push('/dashboard');

        } catch (err) {
            // Manejo de errores: muestra el mensaje de error del backend o un mensaje genérico
            console.error('Error de inicio de sesión:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.');
        } finally {
            setLoading(false); // Desactiva el estado de carga
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700">
            <div className="bg-gray-100 rounded-xl shadow-xl p-8 w-full max-w-md">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Iniciar Sesión</h2>
                {/* Muestra el mensaje de error si existe */}
                {error && <div className="text-red-600 text-sm text-center mb-4">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        name="email"
                        placeholder="Correo electrónico"
                        value={form.email}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="Contraseña"
                        value={form.password}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
                    />
                    <button
                        type="submit"
                        disabled={loading} // Deshabilita el botón durante la carga
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-md transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-700">
                    ¿No tienes una cuenta?{' '}
                    <a href="/register" className="text-blue-700 hover:underline">Regístrate</a>
                </p>
            </div>
        </div>
    );
}
