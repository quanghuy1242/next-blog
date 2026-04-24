/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    // Using unoptimized since R2 handles all image transformations
    unoptimized: true,
  },
  compiler: {
    // Remove React properties for production
    reactRemoveProperties: true,
  },
};

export default nextConfig;
