import * as Sentry from '@sentry/gatsby'

const __IS_DEV__ = process.env.NODE_ENV !== 'production'

Sentry.init({
  dsn: 'https://e2561f72b4484d0c874eecbde0ad297d@o991058.ingest.sentry.io/5947974',
  sampleRate: 1.0,
  release: process.env.RELEASE,

  // This sets the sample rate to be 0.1%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: __IS_DEV__ ? 1.0 : 0.001,
  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 0.05,

  tracesSampleRate: __IS_DEV__ ? 1.0 : 0.3,

  integrations: [new Sentry.Replay(), new Sentry.BrowserTracing()],

  ignoreErrors: [
    /minified react error/i,

    // See: https://docs.sentry.io/platforms/javascript/guides/gatsby/configuration/filtering/#decluttering-sentry
    // Random plugins/extensions
    'top.GLOBALS',
    // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'http://tt.epicplay.com',
    "Can't find variable: ZiteReader",
    'jigsaw is not defined',
    'ComboSearch is not defined',
    'http://loading.retry.widdit.com/',
    'atomicFindClose',
    // Facebook borked
    'fb_xd_fragment',
    // ISP "optimizing" proxy - `Cache-Control: no-transform` seems to
    // reduce this. (thanks @acdha)
    // See http://stackoverflow.com/questions/4113268
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    // See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
    'conduitPage',
  ],
  denyUrls: [
    // Facebook flakiness
    /graph\.facebook\.com/i,
    // Facebook blocked
    /connect\.facebook\.net\/en_US\/all\.js/i,
    // Woopra flakiness
    /eatdifferent\.com\.woopra-ns\.com/i,
    /static\.woopra\.com\/js\/woopra\.js/i,
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Other plugins
    /127\.0\.0\.1:4001\/isrunning/i, // Cacaoweb
    /webappstoolbarba\.texthelp\.com\//i,
    /metrics\.itunes\.apple\.com\.edgesuite\.net\//i,
  ],
})
