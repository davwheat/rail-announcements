import Link from 'next/link'
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
      <Link href="/">Home</Link>
      <Link href="/amey-live-train-announcements">Live announcements</Link>
      <Link href="/about">About</Link>
      <Link href="/changelog">Latest changes</Link>
    </nav>
  )
}
