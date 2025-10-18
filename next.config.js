require('dotenv').config();

const withTM = require('next-transpile-modules')([
  'hastscript',
  'property-information',
  'hast-util-parse-selector',
  'space-separated-tokens',
  'comma-separated-tokens',
]);

module.exports = withTM({
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN:
      process.env.NEXT_EXAMPLE_CMS_DATOCMS_API_TOKEN,
  },
});
