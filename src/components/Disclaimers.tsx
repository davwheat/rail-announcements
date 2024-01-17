import React from 'react'

interface DisclaimersProps {
  customDisclaimers?: React.ReactNode[]
}

export default function Disclaimers({ customDisclaimers = [] }: DisclaimersProps) {
  return (
    <>
      <aside
        key="base"
        css={{
          marginTop: 24,
          padding: '24px 16px',
          background: '#eee',

          '& > :last-child': {
            marginBottom: 0,
          },

          '& > h2:not(:first-of-type)': {
            marginTop: 16,
          },
        }}
      >
        <h2>Attribution and copyright</h2>
        <p>
          Content on this site has either been self-recorded, or released into the public domain via Freedom of Information requests. Copyright
          may still apply to these files, and may be held by either the respective TOCs, PIS/CIS manufacturers or even the voice artists.
        </p>
        <p>
          You <u>must not</u> use the content on this site for commercial purposes. These files and systems are provided for personal use only in
          an attempt to archive present-day and historical PIS/CIS systems. Abuse of the website and its contents could result in legal action
          against you by copyright holders, and/or cause this site to be taken down.
        </p>

        <h2>Health and safety</h2>
        <p>
          This website is provided for educations and entertainment purposes only. It may not be used as a replacement for a public customer
          information system or be used as a source of accurate real-time data.
        </p>
      </aside>

      {customDisclaimers.map((disclaimer, index) => (
        <aside
          key={index}
          css={{
            marginTop: 24,
            padding: '24px 16px',
            background: '#eee',

            '& > :last-child': {
              marginBottom: 0,
            },

            '& > h2:not(:first-of-type)': {
              marginTop: 16,
            },
          }}
        >
          {disclaimer}
        </aside>
      ))}
    </>
  )
}
