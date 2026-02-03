/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@whiskeysockets/baileys'],
  },
};

module.exports = nextConfig;
