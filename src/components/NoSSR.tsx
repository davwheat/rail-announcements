import * as React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function NoSSR({ children, fallback }: Props) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return fallback
  }

  return children
}
