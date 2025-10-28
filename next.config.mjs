/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Using unoptimized since R2 handles all image transformations
    unoptimized: true,
    // Increase minimum cache TTL to 4 hours (Next.js 16 default)
    minimumCacheTTL: 14400, // 4 hours
  },
  compiler: {
    // Remove React properties for production
    reactRemoveProperties: true,
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Enable React Compiler for automatic memoization
  reactCompiler: {
    compilationMode: 'annotation', // Only compile components with "use memo" directive
  },
  // Performance optimizations
  experimental: {
    // Enable Turbopack file system caching for development
    turbopackFileSystemCacheForDev: true,

    // Optimize package imports for faster builds
    optimizePackageImports: [
      'date-fns',
      'date-fns-tz',
      '@payloadcms/richtext-lexical',
    ],
  },

  // Remove powered by header
  poweredByHeader: false,

  // React strict mode for better development
  reactStrictMode: true,

  // Compress responses (enabled by default in production)
  compress: true,
};

export default nextConfig;
