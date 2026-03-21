/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  serverExternalPackages: ['@vercel/kv'],
};

module.exports = nextConfig;
