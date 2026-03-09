# UK Railway Announcements

[View the website!](https://railannouncements.co.uk/)

A website to generate and play UK railway announcements.

> **Info**
>
> Due to a legal notice by Worldline IT Services UK Limited, Atos Anne's audio recordings are no longer available.
>
> For more information, please visit https://railannouncements.co.uk/atos-worldline

## Introduction

When Phil Sayer slowly begun leaving the railway, I wished I had gotten more recordings of his announcements. Because I didn't do that back then,
I decided I'll do it proactively this time!

## Contributing

> ⚠️ **Please follow these guidelines before submitting any files. If you don't, your PR may not be accepted.**

### Audio contributions

The folder for audio files can be found at `audio/`.

- Open a separate pull request for each announcement system you're modifying.
- Audio files should be split wherever possible, but don't overdo it.
- Audio files **must** be `mp3` files due to their [wide browser support](https://caniuse.com/mp3).
- **Files should be named based on the audio within them.** For example "We will be calling at" should be `we will be calling at.mp3`.
- Stations should be saved by their CRS code.
  - Some announcement systems use a high and low pitch version depending on whether they're at the start or end of a sentence, such as the Class
    700/707/717.
  - Don't know a CRS code? Use [http://national-rail-api.davwheat.dev/crs/<search term>](http://national-rail-api.davwheat.dev/crs/brighton), or
    the National Rail Journey Planner.
  - _For example, Brighton should be `BTN.mp3`._

### Running the website locally

You'll need to install [Node.js](https://nodejs.org/en) and the [Yarn package manager](https://yarnpkg.com/getting-started/install) as
prerequisites.

When you've cloned the repository, install the required dependencies with Yarn:

```bash
yarn install
```

Then start the development server:

```bash
yarn dev
```

The website will be available at [http://localhost:3000](http://localhost:3000).

For full functionality, run these additional servers in separate terminals:

**Cloudflare Workers backend** (required for live trains features):

```bash
yarn develop:workers
```

Next.js will automatically proxy `/api/*` requests to Wrangler at `:8787`, so no CORS issues arise.

**Audio server** (required for announcement playback):

```bash
yarn serve-audio
```

#### Additional steps

Some features require additional work in order to test locally.

##### Realtime Trains importing

You'll need to create a `.dev.vars` file at the root of the repository with your [RTT API](https://api.rtt.io/) username and password:

```bash
RTT_API_USERNAME=rttapi_username
RTT_API_PASSWORD=your_password
```

### Website contributions

This site is built with [Next.js](https://nextjs.org/) and React. If you're not familiar with them, you may want to read their documentation
before contributing.

**Before committing your changes, format your code:**

```bash
yarn format
```
