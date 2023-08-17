# UK Railway Announcements

[View the website!](https://rail-announcements.davwheat.dev/)

A website to generate and play UK railway announcements.

## Introduction

When Phil Sayer slowly begun leaving the railway, I wished I had gotten more recordings of his announcements. Because I didn't do that back then,
I decided I'll do it proactively this time!

## Contributing

> ⚠️ **Please follow these guidelines before submitting any files. If you don't, your PR may not be accepted.**

### Audio contributions

The folder for audio files can be found at `static/audio/`.

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

### Website contributions

This site is created with the React Framework using Gatsby. If you're not familiar with React or Gatsby, you may want to research them before
contributing.

**Set up dev environment:**

```
git clone https://github.com/davwheat/rail-announcements
yarn install
yarn start
```

**Before committing your changes, format your code:**

```
yarn run format
```
