import Layout from '@components/Layout'
import NavBar from '@components/NavBar'
import Breakpoints from '@data/breakpoints'

export default function AboutPage() {
  return (
    <Layout
      title="About"
      description="Rail announcements is a website developed by David Wheatley, containing various announcement systems utilising freedom of information released and recorded audio."
    >
      <header>
        <h1>About</h1>
      </header>

      <NavBar />

      <main
        css={{
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
        }}
      >
        <img
          css={{
            float: 'left',
            marginTop: 10,
            marginRight: 32,
            marginBottom: 32,
            borderRadius: '50%',
            shapeOutside: 'circle(50%)',

            [Breakpoints.upTo.bigPhone]: {
              margin: 'auto',
              marginBottom: 32,
              float: 'none',
              textAlign: 'center',
            },
          }}
          width={150}
          height={150}
          src="/images/dav.jpg"
          alt="Portrait image of David"
        />

        <p>
          This site is developed and maintained by <a href="https://github.com/davwheat">David Wheatley</a>, a train, plane, and mobile
          networking enthusiast.
        </p>

        <p>
          Most of the announcements on this site are recorded in-person, so quality can be quite sketchy. If you have any better recordings of
          any snippets, please get in touch over on <a href="https://github.com/davwheat/rail-announcements">this site's GitHub repository</a>!
        </p>

        <p>
          Some announcements are collated from various Freedom of Information requests, such as: ScotRail; Class 700; and all TfL systems. The
          announcements are <strong>not</strong> licensed under the same MIT license that this website's source code is licensed under. Please
          ensure you follow the appropriate licensing terms when using these announcements.
        </p>
      </main>
    </Layout>
  )
}
