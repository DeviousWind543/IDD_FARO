import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/IDD_FARO', 
  assetPrefix: '/IDD_FARO/',
  trailingSlash: true, // Agrega una barra al final de las URLs, mejor para servidores estáticos
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;