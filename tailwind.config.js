/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ESTO ES LO QUE HACE QUE EL BOTÓN FUNCIONE
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}