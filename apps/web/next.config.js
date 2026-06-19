/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-globe.gl / three ESM paketleri için transpile (gerekirse).
  transpilePackages: ['react-globe.gl', '@dunya/contracts'],
};

module.exports = nextConfig;
