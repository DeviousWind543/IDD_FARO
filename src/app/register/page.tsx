'use client'; // Indicates this component is a Client Component in Next.js App Router

import { useState, ChangeEvent, FormEvent } from 'react'; // Import ChangeEvent and FormEvent for type safety
import axios from 'axios'; // HTTP client for making backend requests
import { useRouter } from 'next/navigation'; // Next.js hook for programmatic navigation
import { motion } from 'framer-motion'; // Import motion for animations

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Interface for the register form state
interface RegisterFormState {
  name: string;
  email: string;
  password: string;
}

/**
 * @function RegisterPage
 * @description Page component for user registration with a modern, animated design.
 */
export default function RegisterPage() {
  const router = useRouter();
  // Explicitly type the useState for the form
  const [form, setForm] = useState<RegisterFormState>({ name: '', email: '', password: '' });
  const [error, setError] = useState<string>(''); // Explicitly type error as string
  const [success, setSuccess] = useState<string>(''); // Explicitly type success as string
  // New state to control password visibility
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false); // Explicitly type passwordVisible as boolean
  const [loading, setLoading] = useState<boolean>(false); // ADDED: Loading state for the button

  /**
   * @function handleChange
   * @description Handles changes in form inputs and updates the `form` state.
   * @param {ChangeEvent<HTMLInputElement>} e - Change event from the input.
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  /**
   * @function togglePasswordVisibility
   * @description Toggles the password visibility state.
   */
  const togglePasswordVisibility = () => {
    setPasswordVisible(prev => !prev);
  };

  /**
   * @function handleSubmit
   * @description Handles the submission of the registration form.
   * @param {FormEvent} e - Form submission event.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(''); // Clear previous success message
    setLoading(true); // Set loading to true when submission starts

    try {
      // The backend (authController.js) handles the default role_id (4 in your case)
      await axios.post(`${API_BASE_URL}/auth/register`, form);
      setSuccess('¡Registro exitoso! Redirigiendo a la página de inicio de sesión...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) { // Use 'any' for err if its type is not strictly known
      console.error('Registration error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Error al registrarse. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false); // Set loading to false when submission ends (either success or error)
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden p-4">
      {/* Video de fondo */}
      {/* Ensure '1.mp4' is in your public directory or provide a valid URL */}
      <video
        className="absolute top-0 left-0 w-full h-full object-cover opacity-40"
        src="/1.mp4"
        autoPlay
        loop
        muted
        playsInline
        onError={(e) => console.error("Error loading video:", e.currentTarget.error)}
      >
        Tu navegador no soporta el elemento de video.
      </video>

      {/* Luces neón animadas */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-[150px] animate-pulse top-[-150px] left-[-150px]" />
        <div className="absolute w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-[150px] animate-ping bottom-[-100px] right-[-100px]" />
      </div>

      {/* Card con glassmorphism */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl mx-auto"
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Crear Cuenta
        </h2>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm sm:text-base text-center mt-4"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-green-400 text-sm sm:text-base text-center mt-4"
          >
            {success}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Name Input */}
          <div className="relative group">
            <input
              type="text"
              name="name"
              placeholder="Nombre completo"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400 transition text-base sm:text-lg"
            />
          </div>

          {/* Email Input */}
          <div className="relative group">
            <input
              type="email"
              name="email"
              placeholder="Correo electrónico"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400 transition text-base sm:text-lg"
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <input
              type={passwordVisible ? 'text' : 'password'}
              name="password"
              placeholder="Contraseña"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400 transition pr-10 text-base sm:text-lg"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-300 hover:text-white"
              aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {passwordVisible ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.577 3.01 9.964 7.173a1.012 1.012 0 0 1 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.577-3.01-9.964-7.173Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.577 3.01 9.964 7.173a1.012 1.012 0 0 1 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.577-3.01-9.964-7.173Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </button>
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(0,255,255,0.8)' }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading} // Now 'loading' is correctly defined
            className="w-full py-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold transition disabled:opacity-50 text-base sm:text-lg"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm sm:text-base text-gray-300">
          ¿Ya tienes una cuenta?{' '}
          <a href="/login" className="text-purple-400 hover:underline">
            Inicia sesión
          </a>
        </p>
      </motion.div>
    </div>
  );
}
