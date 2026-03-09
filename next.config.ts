/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // IMPORTANTE: basePath debe ser el nombre del repositorio
  basePath: '/IDD_FARO',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
    devIndicators: false
}

module.exports = nextConfig