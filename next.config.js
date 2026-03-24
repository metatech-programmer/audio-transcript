/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  serverExternalPackages: ['@supabase/supabase-js'],
};

module.exports = nextConfig;
