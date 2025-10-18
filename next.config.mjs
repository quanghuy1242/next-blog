/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'hastscript',
    'property-information',
    'hast-util-parse-selector',
    'space-separated-tokens',
    'comma-separated-tokens',
  ],
  env: {
    NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN:
      process.env.NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN,
  },
};

export default nextConfig;
