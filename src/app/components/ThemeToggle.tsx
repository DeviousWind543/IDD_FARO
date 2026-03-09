'use client'
import { useTheme } from '@/context/ThemeContext' // Importamos el hook
import { FiSun, FiMoon } from 'react-icons/fi'
import { motion } from 'framer-motion'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme(); // Usamos el estado global

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-200 dark:bg-slate-700/50 hover:bg-gray-300 dark:hover:bg-slate-600/50 text-amber-500 dark:text-indigo-300 transition-colors border border-gray-300 dark:border-slate-600/50"
      aria-label="Cambiar tema"
    >
      {isDark ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
    </motion.button>
  )
}