# GTR Railway Announcements

When Phil Sayer slowly begun leaving the railway, I wished I had gotten more recordings of his announcements to relive the "good days".

Because I didn't do that, I decided I'll do it proactively this time!

This repo contains automated announcements for GTR's Atos announcements system at stations, as well as the Class 377/387 (Southern/Gatwick
Express) and Class 700 (Thameslink) PIS systems.

## Status

| Type                  | Status         |
| --------------------- | -------------- |
| Thameslink on-train   | 🚧 In progress |
| Southern on-train     | 🚧 In progress |
| Station announcements | ⏸ To do        |

## Contributing

Please follow these guidelines before submitting any files. If you don't, your PR may not be accepted.

- Audio files should be split wherever possible, but don't overdo it.
- Files should be named by the audio within them. For example "We will be calling at" should be `we will be calling at.mp3`.
- Stations should be saved by their CRS code. Class 700s use a high and low pitch version depending on whether they're at the start or end of a
  sentence.
  - Don't know a CRS code? Use [http://national-rail-api.davwheat.dev/crs/<search term>](http://national-rail-api.davwheat.dev/crs/brighton), or
    the National Rail Journey Planner.
  - For example, Brighton should be `BTN.mp3`.
