const __IS_DEV__ = process.env.NODE_ENV !== 'production'

// These plugins will only be used in production builds
const prodPlugins = !__IS_DEV__ ? [] : []

module.exports = {
  siteMetadata: {
    siteUrl: 'https://rail-announcements.davwheat.dev',
    title: 'UK Rail Announcement Generator',
    description: 'Generate various station and on-train announcements for the UK rail network using raw audio recordings.',
    author: 'David Wheatley',
  },
  flags: {
    DEV_SSR: true,
  },
  plugins: [
    ...prodPlugins,
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    `gatsby-plugin-react-head`,
    {
      resolve: `gatsby-plugin-emotion`,
      options: {
        sourceMap: true,
        autoLabel: 'always',
        labelFormat: `[local]`,
        cssPropOptimization: true,
      },
    },
    `gatsby-plugin-less`,
    `gatsby-plugin-webpack-bundle-analyser-v2`,
    `gatsby-plugin-provide-react`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `UK Rail Announcements`,
        short_name: `Rail Announcements`,
        start_url: `/?utm_source=pwa`,
        background_color: `#000`,
        theme_color: `#ffa500`,
        display: `minimal-ui`,
        icon: `src/images/rs2.png`,
      },
    },
    {
      resolve: '@sentry/gatsby',
    },
    {
      resolve: 'gatsby-plugin-react-svg',
      options: {
        rule: {
          include: /\.inline\.svg$/,
        },
      },
    },
  ],
}
