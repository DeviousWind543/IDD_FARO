// next.config.js
const nextConfig = {
  // Las propiedades "output: 'export'", "trailingSlash" y "basePath"
  // son solo para exportaciones estáticas y no se necesitan en Vercel.
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;