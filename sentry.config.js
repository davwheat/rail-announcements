import * as Sentry from '@sentry/gatsby'

const __IS_DEV__ = process.env.NODE_ENV !== 'production'

Sentry.init({
  dsn: 'https://279592508f584cf4ba1bea11482ddf89@o991058.ingest.sentry.io/6778122',
  sampleRate: __IS_DEV__ ? 1.0 : 0.7,
  release: process.env.RELEASE,
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: __IS_DEV__ ? 1.0 : 0.1,
  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  integrations: [new Sentry.Replay()],
})
