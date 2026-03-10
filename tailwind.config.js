/** @type {import('tailwindcss').Config} */
const prefix = process.env.NODE_ENV === 'production' ? '/IDD_FARO' : '';

module.exports = {
  darkMode: 'class', 
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Esto te permite usar bg-hero-pattern en Tailwind y que funcione en GitHub Pages
      backgroundImage: {
        'custom-logo': `url('${prefix}/LIDD2.webp')`,
      },
    },
  },
  plugins: [],
};