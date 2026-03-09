'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-black overflow-hidden text-white">

      {/* VIDEO DE FONDO */}
      <video
        className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-40"
        src="/1.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* EFECTO DE LUCES NEÓN GIRATORIAS */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-[150px] animate-pulse top-[-150px] left-[-150px]" />
        <div className="absolute w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-[150px] animate-ping bottom-[-100px] right-[-100px]" />
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="relative max-w-5xl w-full bg-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-2xl border border-white/10"
      >
        {/* LOGO */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative flex items-center justify-center p-6 w-full md:w-1/3 bg-gradient-to-b from-white/10 to-transparent"
        >
          <Image
            src="/LIDD2.webp"
            alt="Logo"
            width={800}
            height={800}
            className="w-full h-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
            priority
          />
        </motion.div>

        {/* TEXTO Y BOTONES */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="flex flex-col items-center justify-center p-8 text-center w-full md:w-2/3"
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
            Bienvenido a tu comunidad
          </h1>
          <p className="text-lg sm:text-xl mb-8 text-gray-200 max-w-lg">
            Conecta, comparte y vive experiencias únicas con personas como tú.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href="/login"
              className="px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 w-full sm:w-auto bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:scale-105 hover:shadow-[0_0_20px_rgba(255,0,255,0.8)]"
            >
              Registrarse
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
