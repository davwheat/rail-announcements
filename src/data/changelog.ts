interface IChangelogVersion {
  date: string
  additions?: string[]
  fixes?: string[]
  otherChanges?: string[]
}

const changelog: IChangelogVersion[] = [
  {
    date: '2021-08-28',
    additions: ['Initial release of website with very basic Class 377/700 systems'],
  },
  {
    date: '2021-08-29',
    additions: ['Use Rail Alphabet font for website UI', 'Add logo and favicon'],
    fixes: ['Fix incorrect page titles'],
  },
  {
    date: '2021-08-30',
    additions: ['[Class 700] Add Horley and Salfords stations', '[Class 700] Add new "Take care as you leave the train" message'],
    fixes: [
      'Add missing CSS styling for disabled buttons',
      '[Class 700] Fix incorrect announcement when stopped at a station where next stop is the termination point',
      '[Class 700] Fix incorrect audio snippet playing for next stop termination upon initial departure',
    ],
  },
  {
    date: '2021-09-07',
    additions: [
      '[Atos] Add Matt Streeton announcements',
      '[Atos] Add Anne announcements',
      '[KeTech] Add Phil Sayer announcements',
      '[KeTech] Add Celia Drummond announcements',
      'Add Sentry to track errors in production',
    ],
    fixes: ['[Class 700] Update various snippets with better quality', '[Class 377] Update various snippets with better quality'],
  },
  {
    date: '2021-09-24',
    additions: ['[Class 700] Add new held at red signal and face covering announcements'],
    fixes: [
      '[KeTech] Reduce volume of announcement chimes',
      "[Atos - Matt] Don't repeat basic train info at the end of an announcement",
      'Prevent interacting with announcement controls when an announcement is playing',
      "Don't auto-select a number of coaches where no audio exists for that number",
    ],
  },
  {
    date: '2021-09-28',
    additions: [
      '[Class 700] Add announcement presets',
      '[Class 377] Add new stations',
      '[Atos - Anne] Add new audio snippets',
      '[Atos - Matt] Add new audio snippets',
      '[Atos - Matt] Support alternative services message during delays/cancellations',
    ],
    fixes: ['[Class 700] Validate selection for terminating station', 'Fix unnecessary re-renders'],
    otherChanges: ['[Class 377] Rename system to Bombardier XStar'],
  },
  {
    date: '2021-10-17',
    additions: ['[Class 700] Play safety information message after initial departure'],
    fixes: [
      '[Atos - Matt] Only play alternate services when the delay time is known',
      '[Atos - Matt] Fix incorrect CRS code for Shoreham-by-Sea',
      '[Atos - Matt] Fix broken preset',
      'Style improvements for radio buttons',
    ],
  },
  {
    date: '2021-11-08',
    additions: [
      '[Class 700] Add more station audio snippets',
      '[Atos - Anne] Add support for delays and cancellations',
      '[Atos - Matt] Add more disruption presets',
      '[Atos - Matt] Add more disruption reasons',
    ],
    fixes: ['[Atos] Fix platform and delay time not displaying correctly when using a preset', 'Change button colour on hover'],
  },
  {
    date: '2021-12-03',
    additions: [
      '[Atos - Anne] Add missing stations between Crawley and Peterborough',
      '[Atos - Anne] Add seating availability message option',
      '[Atos] Add new GTR face covering announcement',
    ],
    fixes: ['[Atos - Matt] Replace various low quality audio snippets'],
  },
  {
    date: '2021-12-08',
    additions: [
      '[Atos/KeTech] Fix blank TOC select box by default',
      '[Atos - Anne] Add new correct ticket message',
      '[Class 700] Add voice artist name',
      'Add support for announcement button sections',
    ],
    fixes: [
      '[Atos] Replace various low quality audio snippets',
      '[Atos - Anne] Changing disrupted train platform manually breaks announcement playback',
      '[KeTech Celia] Remove "via" option',
      '[KeTech Celia] Replace low quality audio snippets',
    ],
  },
  {
    date: '2022-02-07',
    additions: [
      '[Bombardier XStar] Add BTP/61016 announcement',
      '[Bombardier XStar] Add announcement to "take your belongings with you"',
      '[Bombardier XStar] Add more stations',
      '[KeTech] Add train standing annoucement',
      '[Atos] Add more disruption snippets',
    ],
    fixes: ['Fix error caused by hook count changing when options change'],
  },
  {
    date: '2022-08-22',
    additions: [
      '[Class 700] Replace self-recorded announcements with those from Southeastern Freedom of Information request',
      '[Class 700] Add manual PA chime',
      '[KeTech] Add British Rail fanfare sound effect',
    ],
  },
  {
    date: '2022-08-24',
    additions: ['[Class 700] Add support for stations on the Siemens test track'],
    fixes: ['[Class 700] Remove announcements which are actually XStar announcements'],
  },
  {
    date: '2022-08-25',
    additions: ['Add audio data to Sentry error reports'],
    fixes: ['[KeTech Celia] Disable Virgin Pendolino and London Midland TOCs', 'Perform more checks before playing audio to prevent errors'],
    otherChanges: ['Update Sentry and improve configuration', 'Upload sourcemaps to Sentry upon GitHub Actions CI build and deployment'],
  },
  {
    date: '2022-08-29',
    fixes: ['[Class 700] Fix typo in FOI response filename', 'Sentry discarding some info in error report data'],
  },
  {
    date: '2022-08-31',
    fixes: ['[Class 700] Fix wrong change info snippet playing for East Croydon'],
  },
  {
    date: '2022-09-06',
    additions: ['[TfL Jubilee] Add Jubilee Line announcement system'],
    otherChanges: [
      'Migrate to react-select for auto-complete support',
      'Switch from Preact to React',
      'Rework GitHub Actions CI to utilise new Pages deployment method',
    ],
  },
  {
    date: '2022-09-11',
    additions: ['[ScotRail] Add basic ScotRail announcement system', '[TfL Jubilee] Add Jubilee Line announcement system'],
    fixes: ['[KeTech] Use high quality snippet for British Rail fanfare'],
  },
  {
    date: '2022-09-23',
    additions: ['[TfL Jubilee Line] Add post-Elizabeth line opening announcements for Canary Wharf and Stratford'],
    fixes: ['[TfL Jubilee Line] Fix next station announcement not working for Green Park and Finchley Road'],
  },
  {
    date: '2022-09-24',
    additions: ['Add new About and Changelog pages'],
  },
  {
    date: '2022-10-06',
    additions: ['[TfL Northern Line] Add Northern Line announcement system (only destination and next station info)'],
  },
]

export default changelog
