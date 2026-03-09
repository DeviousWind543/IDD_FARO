/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ESTO HACE QUE EL BOTÓN FUNCIONE
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    // ✅ Añade estas rutas para Next.js 15 con App Router
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};