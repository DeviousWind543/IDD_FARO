import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Frontend-next',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  trailingSlash: true,
  devIndicators: false,
  // IGNORAR ERRORES DE ESLINT DURANTE EL BUILD
  eslint: {
    ignoreDuringBuilds: true,
  },
  // IGNORAR ERRORES DE TYPESCRIPT
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;