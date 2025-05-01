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
  {
    date: '2022-10-07',
    additions: [
      '[TfL Northern Line] Add thank you messages to terminating announcements',
      '[TfL Northern Line] Add "T" to show stations where trains can terminate',
    ],
  },
  {
    date: '2022-10-14',
    fixes: ['[TfL Northern Line] Fix "Kennington (change for southbound trains)" announcement'],
  },
  {
    date: '2022-11-21',
    fixes: ['[TfL Jubilee Line] Fix Canary Wharf Elizabeth Line playing Bond Street instead (thanks @00p513-dev)'],
  },
  {
    date: '2022-11-30',
    additions: ['[TfL Northern Line] Add stopped-at-station announcements'],
    fixes: ['[Class 700] Fix broken announcement button panel'],
  },
  {
    date: '2022-12-01',
    fixes: ['[Atos - Matt] Fix broken disruption options'],
  },
  {
    date: '2022-12-04',
    additions: ['[TfL Northern Line] Use re-recorded Northern Line Extension and Elizabeth Line announcements for applicable stations'],
    otherChanges: ['Upgrade to Gatsby 5 and React 18'],
  },
  {
    date: '2022-12-09',
    additions: ['[Class 700] Add option to be Southeastern service'],
  },
  {
    date: '2023-02-19',
    additions: ['[TfW TrainFX] Add new TrainFX announcement system for Transport for Wales trains'],
  },
  {
    date: '2023-03-04',
    additions: ['[TfL Elizabeth Line] Add new Elizabeth Line announcement system'],
  },
  {
    date: '2023-03-14',
    additions: ['[Atos - Anne] Use real audio clips for announcements'],
  },
  {
    date: '2023-05-02',
    fixes: [
      '[TfL Northern Line] Next station announcement not working for Leicester Square',
      '[TfL Elizabeth Line] Approaching station announcement not working for Whitechapel',
      '[Bombardier XStar] Replace some audio snippets with higher quality versions',
    ],
  },
  {
    date: '2023-07-24',
    otherChanges: ['Updated list of all GB stations'],
  },
  {
    date: '2023-07-26',
    fixes: ['[TfL Jubilee Line] Fix standing at North Greenwich announcement'],
  },
  {
    date: '2023-08-14',
    fixes: ['[Atos - Anne] Fix bug where using alternative services would break the site'],
  },
  {
    date: '2023-08-17',
    otherChanges: [
      '[Atos - Anne] In response to a legal notice from Atos, I have had to remove the Anne announcement generator and audio files',
    ],
  },
  {
    date: '2023-08-21',
    otherChanges: [
      '[Atos - Matt] In response to a legal notice from Atos, I have had to remove the Matt announcement generator and audio files',
    ],
  },
  {
    date: '2023-08-23',
    fixes: [
      '[Bombardier XStar] Fix Waterloo (Merseyrail) appearing in the list of stations',
      '[ScotRail] Fix error when using 1 coach for train formation',
      '[KeTech - Celia] Fix error when playing announcement with no TOC selected',
      '[TfW - TrainFX] Fix Fishguard and Goodwick snippet erroring sometimes',
      '[TfL Northern Line] Fix next station Goodge Street not working',
    ],
  },
  {
    date: '2023-10-20',
    fixes: ['[TfW - TrainFX] Add start of journey announcement'],
  },
  {
    date: '2023-11-17',
    additions: ['[KeTech Phil] Add disruption announcements', '[KeTech Phil] Add (beta) live train announcements'],
  },
  {
    date: '2023-11-22',
    additions: ['[Amey Celia] Replace KeTech Celia with Amey Celia using raw audio files'],
    otherChanges: ['[Amey Phil] Renamed KeTech Phil to Amey Phil to reflect his wording and scripts'],
  },
  {
    date: '2023-11-25',
    fixes: [
      '[Amey Celia] Increase spacing between calling points',
      '[Amey Celia] Cut down spacing before TOC',
      '[Amey Celia] Always default to 3-note chime',
      "[Amey Celia & Phil] Add missing 'from this station' for cancellations",
      '[Amey Celia & Phil] Swap out some files for more accurate snippets',
    ],
    additions: ['[Amey Celia] Add custom Northern TOC snippets'],
  },
  {
    date: '2023-11-26',
    fixes: ["[Amey Live Trains] Don't announce delayed trains after departure"],
    additions: ['[Amey Live Trains] Add disruption announcements'],
  },
  {
    date: '2023-11-30',
    fixes: [
      '[Amey Celia & Phil] Allow announcing a split with no further calling points',
      '[Amey Celia & Phil] Wrong delayed snippets for some messages',
    ],
  },
  {
    date: '2023-12-08',
    fixes: [
      "[Amey Celia & Phil] Use 'hundred-hour' instead of 'hundred'",
      '[Amey Live Trains] Handle fake destinations correctly',
      '[Amey Celia & Phil] Various sound snippet swaps',
      '[Amey Celia & Phil] Tweak spacing based on real-world recordings',
    ],
  },
  {
    date: '2023-12-09',
    fixes: ["[Amey Celia & Phil] Use 'hundred-hour' instead of 'hundred'"],
    additions: ['[Amey Live Trains] Announce delay reasons', '[Amey Celia & Phil] Add fast train option'],
  },
  {
    date: '2023-12-11',
    fixes: ['[Class 700] Add missing Circle & District lines for Blackfriars'],
    additions: ['[Amey Phil] Bodged GWR TOC snippet'],
  },
  {
    date: '2023-12-12',
    additions: ['[LNER Azuma] Add Azuma announcement system', '[Amey Celia & Phil] Add approaching train option'],
  },
  {
    date: '2023-12-18',
    additions: ['[Amey Phil & Celia] Add missing Hampton Wick and West Ham stations'],
    fixes: [
      "[Amey Live Trains] Don't announce unadvertised stops (e.g. City Thameslink AC/DC switchover after it closes)",
      "[Amey Live Trains] Manual override for some via points (e.g. 'via Cobham' will be announced correctly now)",
    ],
  },
  {
    date: '2023-12-19',
    otherChanges: ['Website styling changes and reorganisation', 'Use RA2 font for website'],
  },
  {
    date: '2023-12-20',
    additions: [
      'Sharable announcements: you can now share announcements with a link',
      '[Amey Phil & Celia] Add First Great Eastern, Greater Anglia, Great Western Railway and SWR to supported TOCs',
    ],
    fixes: ['[Amey Phil] Fix broken Warwick Parkway announcement', '[Bombardier XStar] Correct announcement when terminating at station'],
  },
  {
    date: '2023-12-21',
    additions: ['Save your own announcements to on-device custom presets'],
  },
  {
    date: '2023-12-24',
    additions: [
      '[Amey Live Trains] Trigger approaching train announcements',
      '[Amey Phil] Many additional bodged station recordings',
      '[Amey Phil] Additional announcement buttons',
    ],
    fixes: ['[TfL Elizabeth line] Fix broken Cambridge Heath announcement', '[Amey Celia] Fix broken TOCs'],
  },
  {
    date: '2024-01-01',
    additions: ['[TfW TrainFX] Add missing "thank you" to start of journey announcement', '[Amey Live Trains] Pick your own display type'],
    fixes: ['[TfW TrainFX] Correct station code and name for Clarbeston Road'],
  },
  {
    date: '2024-01-07',
    additions: ['[Amey Phil/Celia/Live Trains] Add standing at announcement support', '[Amey Celia] Additional platforms'],
  },
  {
    date: '2024-01-15',
    additions: [
      '[Amey Live Trains] Moved to dedicated page',
      '[Amey Live Trains] Combine both Phil and Celia for zoned announcements',
      'Additional information when errors occur',
    ],
    otherChanges: ['[Amey Phil & Celia] Improved splitting formation audio'],
    fixes: [
      '[Bombardier XStar] Improved audio files for Hove and Preston Park',
      '[Elizabeth Line] Swap some audio files for the correct ones',
      'Migrate to self-hosted Sentry issue tracker',
    ],
  },
  {
    date: '2024-01-16',
    otherChanges: ['Migrated to new style library'],
    fixes: ['[Amey Phil & Celia] Simplify logic for splitting trains with common calling points to match the real world'],
  },
  {
    date: '2024-01-26',
    additions: ['[Amey Live Trains] Announce Eurostar services'],
    fixes: ['[Amey Live Trains] Fix error when no stations are in calling points list'],
  },
  {
    date: '2024-01-27',
    fixes: ['[Amey Phil & Celia] Improved split handling'],
  },
  {
    date: '2024-01-28',
    additions: ['[Amey Phil] More bodged station audio files (APY, ASF, AVP, BOW, BYL)'],
  },
  {
    date: '2024-02-08',
    additions: ['[LNER Azuma] Add Reston station', '[Amey Live Trains] Add option to announce legacy TOCs'],
  },
  {
    date: '2024-02-09',
    additions: ['[Amey Phil & Celia] Add Platform 0', '[Amey Live Trains] Recognise and announce request stops'],
    fixes: ['[Amey Phil & Celia] Corrected audio files used for fast train announcements'],
  },
  {
    date: '2024-02-16',
    additions: ['[Amey Phil & Celia] Platform alteration announcements', '[Amey Celia] WMT/WMR/LNR TOC announcements'],
  },
  {
    date: '2024-02-18',
    additions: ['[Bombardier XStar] Add new station audio snippets'],
    otherChanges: ['Redesign system selection', 'Move systems to individual pages'],
  },
  {
    date: '2024-03-04',
    additions: ['[LNER Azuma] Additional connecting services announcements'],
  },
  {
    date: '2024-03-05',
    fixes: ['Saved announcements broken since the website redesign'],
  },
  {
    date: '2024-03-07',
    additions: ['[Live Announcements] Announce replacement bus continuations where needed'],
  },
  {
    date: '2024-03-10',
    additions: ['[Amey Phil/Celia] Add bodged EMR recordings', '[Amey Phil/Celia] Use Abercynon South for Abercynon station'],
  },
  {
    date: '2024-03-17',
    additions: ['[TfW Televic] Add system for new Transport for Wales rolling stock', '[Live Announcements] Announce train restart after RRB'],
  },
  {
    date: '2024-03-22',
    fixes: ['[Amey Phil/Celia] Support for Chapelton (CPN) station', '[Amey Phil/Celia] Fix wrong inflection for Haymarket (HYM)'],
    otherChanges: ['[Live Announcements] Improved consistency between departure board and announcements, and reduced networking traffic'],
  },
  {
    date: '2024-03-25',
    additions: ['[Amey Phil/Celia] Add option to play Daktronics fanfare for fast trains'],
  },
  {
    date: '2024-04-04',
    additions: [
      '[Amey Phil] Add bodged HRE station files',
      '[Amey Celia] Add bodged TPE TOC snippets',
      '[Live Announcements] Fix announcements playing too early in non-UK timezones',
      '[Live Announcements] Add toggle to include services with unconfirmed platforms on departure board',
    ],
  },
  {
    date: '2024-04-04',
    additions: ['[Amey Phil & Celia] Add bodged LNER TOC files', '[Amey Phil & Celia] Add 1st class location option'],
    fixes: ['[Live Announcements] Don\'t announce pick-up only stops within "calling at"'],
    otherChanges: ['Migrated from GitHub Pages to Cloudflare R2 (for audio storage) and Pages (for the website)'],
  },
  {
    date: '2024-04-29',
    additions: [
      '[Amey Phil & Celia] Add Warrington West and Kirkby stations',
      '[Amey Phil & Celia] Add up to 20 coaches to a train',
      '[Amey Celia] Add Transport for Wales',
    ],
    fixes: ['[Class 700] Fix wrong St Pancras audio'],
  },
  {
    date: '2024-06-01',
    additions: ['[Live Trains] Customise/disable chimes'],
  },
  {
    date: '2024-06-27',
    fixes: ['Fix disruption announcement error when number of minutes is zero'],
  },
  {
    date: '2024-07-06',
    additions: [
      '[Live Trains] Announce (some) GWR named services',
      '[Amey/Live Trains] Add option to announce stations the train will not be calling at',
    ],
    fixes: [
      '[Live Trains] Map new Darwin delay/cancellation reason to announcement files',
      '[Live Trains] Fix wrong short platform announcements after a formation change',
    ],
    otherChanges: ['During local development, audio is no longer fetched from the production CDN'],
  },
  {
    date: '2024-09-22',
    additions: ['For some systems and announcement types, you can now automatically load in announcement data from a Realtime Trains URL'],
  },
  {
    date: '2025-04-25',
    additions: ['New Avanti West Coast Pendolino announcement system'],
  },
  {
    date: '2025-04-28',
    additions: [
      'New West Midlands Railway Class 172 announcement system',
      'New West Midlands Railway Class 323 announcement system',
    ],
  },
]

export default changelog
