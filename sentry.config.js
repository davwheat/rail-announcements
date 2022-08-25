import * as Sentry from '@sentry/gatsby'

const __IS_DEV__ = process.env.NODE_ENV !== 'production'

Sentry.init({
  dsn: 'https://e2561f72b4484d0c874eecbde0ad297d@o991058.ingest.sentry.io/5947974',
  sampleRate: __IS_DEV__ ? 1.0 : 0.7, // Adjust this value in production
  // beforeSend(event) {
  //   return event
  // },
  release: process.env.RELEASE,
})
