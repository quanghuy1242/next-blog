/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Using unoptimized since R2 handles all image transformations
    unoptimized: true,
  },
};

export default nextConfig;
