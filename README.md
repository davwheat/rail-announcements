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

Then you can start the three (yes, three) development services:

```bash
# In one terminal, run (for the website):
yarn run develop

# When this says "You can now view rail-announcements in the browser.", open a new terminal and run (for the live trains API):
yarn run develop:workers

# Finally, open a new terminal and run (to serve the audio files):
yarn run serve-audio
```

You'll be able to access the website at [http://local.davw.network:8787](http://local.davw.network:8787). `local.davw.network` is a domain that
will always resolve to your local machine, and is used to ensure that the website works correctly with the audio files and backend API during
local development.

#### Additional steps

Some features require additional work in order to test locally.

##### Realtime Trains importing

You'll need to create a `.dev.vars` file at the root of the repository with your [RTT API](https://api.rtt.io/) username and password:

```bash
RTT_API_USERNAME=rttapi_username
RTT_API_PASSWORD=your_password
```

### Website contributions

This site is created with the React Framework using Gatsby. If you're not familiar with React or Gatsby, you may want to research them before
contributing.

**Before committing your changes, format your code:**

```bash
yarn run format
```
