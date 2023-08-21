import React from 'react'

import Layout from '@components/Layout'
import NavBar from '@components/NavBar'
import Breakpoints from '@data/breakpoints'

import { makeStyles } from '@material-ui/styles'
import { PageProps } from 'gatsby'

const useStyles = makeStyles({
  root: {
    margin: 'auto',
    maxWidth: 900,

    [Breakpoints.downTo.bigPhone]: {
      marginTop: 64,
    },

    [Breakpoints.upTo.bigPhone]: {
      marginTop: 38,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },

    '& p': {
      marginBottom: 16,
    },
  },
  comms: {
    marginTop: 32,

    '& > h2': {
      marginBottom: 24,
    },
  },
  email: {
    padding: 12,
    background: '#f0f0f0',
    marginBottom: 16,
    border: '2px solid #000',

    '& figcaption': {
      marginBottom: 16,
      padding: 8,
      background: 'white',
    },

    '& pre': {
      padding: 8,
      whiteSpace: 'normal',
      fontSize: 16,
    },
  },
  emailAttachments: {
    padding: 8,
    background: 'white',
    marginTop: 12,

    '& h3': {
      marginBottom: 8,
      fontSize: '0.9em',
    },

    '& .list': {
      fontSize: '0.85em',
    },
  },
})

function AtosWorldlinePage({ location }: PageProps): JSX.Element {
  const classes = useStyles()

  return (
    <Layout location={location}>
      <header>
        <h1>Atos Worldline announcements removal</h1>
      </header>

      <NavBar />

      <main className={classes.root}>
        <article>
          <h2>An open letter</h2>

          <p>To the users of Rail Announcements and all rail enthusiasts</p>

          <p>
            On 17 August 2023, I received an email (found below) from Worldline's Northern Europe legal department. Attached was a letter titled
            "Your use of Worldline intellectual property". This letter noted my usage of Worldline's intellectual property (referring to the
            recordings of Atos Anne and Matt's announcements) and requested that I remove access to and destroy copies of these recordings.
          </p>

          <p>
            Worldline are within their rights to request the removal of their intellectual property (IP), and I appreciate that they have
            directly contacted myself, as opposed to jumping to more severe actions such as issuing a DMCA takedown notice.
          </p>

          <p>
            I am disappointed that Worldline have chosen to take this action, as I believe that the recordings of Atos's announcements are
            important to the history of the UK rail network. It is unrealistic to claim that this website harms Wordline's ability to sell their
            announcement systems to train operating companies and infrastructure managers.
          </p>

          <p>
            I understand that in many jurisdictions, it is required for Worldline to enforce their IP in order to maintain their rights to it.
            Many solutions, including licensing, could have had the potential to allow me to continue to host these recordings in exchange for a
            licensing fee, however, from my understanding, Worldline are not interested in this, or are only willing to do so for exorbitant
            costs for an individual's passion project.
          </p>

          <p>
            This site contains announcement snippets from a large variety of businesses, including Transport for London, Bombardier, and Siemens.
            None of these businesses have requested that I remove their announcements from this site (yet), and I am grateful for this.
          </p>

          <p>
            To the users of this site, I would like to take the opportunity to thank you for your support and use of this website over the past
            few years. With help from social media, this has easily become one of my most popular websites. I am proud to have created something
            that has been enjoyed by so many people.
          </p>

          <p>If Worldline would like to discuss this further, I would be happy to do so, but I do not believe that this will be the case.</p>

          <p>For the sake of transparency, I have included all communication with Worldline below, censoring any personal information.</p>

          <p>
            Yours faithfully,
            <br />
            David Wheatley
            <br />
            <a href="https://davwheat.dev">davwheat.dev</a>
          </p>
        </article>

        <section className={classes.comms}>
          <h2>Communications with Worldline</h2>

          <figure className={classes.email}>
            <figcaption>Wordline legal team's first email to me</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 17 August 2023 10:36 BST, XXXX &lt;XXXX@worldline.com&gt; wrote:
              <br />
              &gt; Dear Mr Wheatley,
              <br />
              &gt;
              <br />
              &gt; Please refer to the attached letter.
              <br />
              &gt;
              <br />
              &gt; Regards
              <br />
              &gt;
              <br />
              &gt;
              <br />
              &gt; XXXX XXXX
              <br />
              &gt; XXXX - Northern Europe
              <br />
              &gt; XXXX@worldline.com
              <br />
              &gt; worldline.com
            </pre>
            <div className={classes.emailAttachments}>
              <h3>Attachments</h3>
              <ul className="list">
                <li>
                  <a href="/atos-worldline-letter-2023-08-17.pdf">Letter to David Wheatley 17082023.pdf</a>
                </li>
              </ul>
            </div>
          </figure>

          <figure className={classes.email}>
            <figcaption>My reply</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 17 August 2023 12:46 BST, David Wheatley &lt;david@davwheat.dev&gt; wrote:
              <br />
              &gt; Hi XXXX,
              <br />
              &gt;
              <br />
              &gt; I can confirm receipt of your email and attached letter. I appreciate you contacting myself prior to taking any formal
              actions, such as a DMCA takedown.
              <br />
              &gt;
              <br />
              &gt; I do not agree with the fact that personal data is present on the websites listed. Instead these are names used widely by
              insiders within the industry, as well as enthusiasts. In many cases, these announcement system names do not actually corroborate
              with the real names of those announcing them. Where the site does list full names, these are already within the public domain and
              released through news sources, such as in the case of Julie Berry.
              <br />
              &gt;
              <br />
              &gt; It could be argued that publication of the recordings themselves could not be in breach of data protection legislation as such
              recordings are already "published" by the way of constant use at the majority of railway stations in the United Kingdom.
              <br />
              &gt;
              <br />
              &gt; With regards to your intellectual property claims, I confirm that I intend to remove access to any proprietary recordings of
              "Atos Anne" from my websites. If any other announcements available are also your intellectual property and require removal, please
              let me know.
              <br />
              &gt;
              <br />
              &gt; Please note that I intend to publish this email conversation and your attached letter in full on the websites to keep members
              of the public informed.
              <br />
              &gt;
              <br />
              &gt; Cheers,
              <br />
              &gt; David Wheatley
            </pre>
          </figure>

          <figure className={classes.email}>
            <figcaption>Worldline's reply</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 18 August 2023 09:06 BST, XXXX &lt;XXXX@worldline.com&gt; wrote:
              <br />
              &gt; Good morning David,
              <br />
              &gt;
              <br />
              &gt; Thanks for your prompt response and confirmation that you intend to remove the files from your websites. In addition to the
              “ATOS Anne” files, the “ATOS – Matt Streeton” files are also Worldline proprietary and should therefore also be removed.
              <br />
              &gt;
              <br />
              &gt; Regards
              <br />
              &gt; XXXX
            </pre>
          </figure>

          <figure className={classes.email}>
            <figcaption>My reply</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 18 August 2023 10:04 BST, David Wheatley &lt;david@davwheat.dev&gt; wrote:
              <br />
              &gt; Hi XXXX,
              <br />
              &gt;
              <br />
              &gt; Is there some evidence you can provide for this?
              <br />
              &gt;
              <br />
              &gt; As I understand it, these recordings were made by an employee of Govia Thameslink Railway rather than one of your own
              employees. I would understand that the technology that combines snippets would be your IP, but I don't understand how recordings
              provided by an external organisation to yourselves would be.
              <br />
              &gt;
              <br />
              &gt; Additionally, all of the "Atos Matt" recordings have been made by myself, stitched together from videos taken in public,
              rather than any other source.
              <br />
              &gt;
              <br />
              &gt; Cheers
              <br />
              &gt; David
            </pre>
          </figure>

          <figure className={classes.email}>
            <figcaption>Worldline's reply</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 21 August 2023 09:44 BST, XXXX &lt;XXXX@worldline.com&gt; wrote:
              <br />
              &gt; Good morning David,
              <br />
              &gt;
              <br />
              &gt; Regardless of how the recordings were obtained, the files contain Worldline IP. They were recorded using a script authored by
              Worldline, at a studio provided by Worldline. The recordings were then edited by a Worldline team to make them fit for purpose and
              Worldline’s proprietary software was then used to “assemble” the audio files in the correct format.
              <br />
              &gt;
              <br />
              &gt; Regards
              <br />
              &gt; XXXX
            </pre>
          </figure>

          <figure className={classes.email}>
            <figcaption>My reply</figcaption>
            <pre style={{ fontFamily: 'Consolas, "Courier New", monospace' }}>
              On 21 August 2023 11:00 BST, David Wheatley &lt;david@davwheat.dev&gt; wrote:
              <br />
              &gt; Hi XXXX,
              <br />
              &gt;
              <br />
              &gt; Many thanks for the clarification.
              <br />
              &gt;
              <br />
              &gt; I will remove these from the websites this afternoon, too.
              <br />
              &gt;
              <br />
              &gt; Cheers
              <br />
              &gt; David
            </pre>
          </figure>
        </section>
      </main>
    </Layout>
  )
}

export default AtosWorldlinePage
