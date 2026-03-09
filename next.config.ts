import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Solo usar basePath en producción
  basePath: process.env.NODE_ENV === 'production' ? '/IDD_FARO' : '',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;