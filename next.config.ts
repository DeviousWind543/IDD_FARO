import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Asegura que se genere la carpeta 'out'
  basePath: '/IDD_FARO', 
  assetPrefix: '/IDD_FARO/', // Crucial para los archivos estáticos
  devIndicators: false,

  images: {
    unoptimized: true, // Requerido para exportación estática en GH Pages
  },
};

export default nextConfig;