/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@wordle-duel/core'],
};

module.exports = nextConfig;
