/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large API payloads for PDF uploads
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],
  },
  // Increase serverless function timeout body size
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: '50mb',
  },
};

module.exports = nextConfig;
