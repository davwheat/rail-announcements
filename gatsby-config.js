const { Integrations: TracingIntegrations } = require('@sentry/tracing')

const __IS_DEV__ = process.env.NODE_ENV !== 'production'

// These plugins will only be used in production builds
const prodPlugins = !__IS_DEV__
  ? [
      {
        resolve: 'gatsby-plugin-remove-console',
        options: {
          exclude: ['error', 'warn'],
        },
      },
      // Fixed hot reload in dev
      `gatsby-plugin-preact`,
    ]
  : []

module.exports = {
  siteMetadata: {
    siteUrl: 'https://rail-announcements.davwheat.dev',
    title: 'Rail Announcements',
    description: 'Announcements for the UK rail network',
    author: '@davwheat',
  },
  plugins: [
    ...prodPlugins,
    `gatsby-plugin-react-head`,
    `gatsby-plugin-material-ui`,
    `gatsby-plugin-less`,
    `gatsby-plugin-webpack-bundle-analyser-v2`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `UK Rail Announcements`,
        short_name: `Rail Announcements`,
        start_url: `/?utm_source=pwa`,
        background_color: `#000`,
        theme_color: `#ffa500`,
        display: `minimal-ui`,
        icon: `src/images/logo.png`, // This path is relative to the root of the site.
      },
    },
    {
      resolve: '@sentry/gatsby',
      options: {
        dsn: 'https://e2561f72b4484d0c874eecbde0ad297d@o991058.ingest.sentry.io/5947974',
        sampleRate: __IS_DEV__ ? 1 : 0.7,
        integrations: [new TracingIntegrations.BrowserTracing()],
        tracesSampleRate: __IS_DEV__ ? 1 : 0.7,
      },
    },
  ],
}
