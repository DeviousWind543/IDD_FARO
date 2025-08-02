'use client'
import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';


export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async e => {
    e.preventDefault()
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, form);
      setSuccess('¡Registro exitoso!')
      setError('')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrarse')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700">
      <div className="bg-gray-100 rounded-xl shadow-xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Crear cuenta</h2>
        {error && <div className="text-red-600 text-sm text-center mb-4">{error}</div>}
        {success && <div className="text-green-600 text-sm text-center mb-4">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Nombre completo"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-800"
          />
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
            className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-md transition font-semibold"
          >
            Registrarse
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-700">
          ¿Ya tienes una cuenta?{' '}
          <a href="/login" className="text-blue-700 hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}
