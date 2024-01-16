import { Link } from 'gatsby'
import Breakpoints from '@data/breakpoints'

export default function NavBar() {
  return (
    <nav
      css={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        justifyItems: 'center',
        marginBlock: 24,
        textAlign: 'center',

        [Breakpoints.upTo.tablet]: {
          gridTemplateColumns: '1fr',
        },
      }}
    >
      <Link to="/">Generator</Link>
      <Link to="/amey-live-train-announcements">Live announcements</Link>
      <Link to="/about">About</Link>
      <Link to="/changelog">Latest changes</Link>
    </nav>
  )
}
