import type { AudioItem } from '@announcement-data/AnnouncementSystem'
import type AnnouncementSystem from '@announcement-data/AnnouncementSystem'
import type React from 'react'

// Allow imports of .svg files by URL
declare module '*.svg' {
  const content: string
  export default content
}

// Allow imports of .png files by URL
declare module '*.png' {
  const content: string
  export default content
}

// Allow imports of .inline.svg files as React components
declare module '*.inline.svg' {
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  const src: string
  export default src
}

// Add to window object
declare global {
  interface Window {
    __audio?: AudioItem[]
    __system?: typeof AnnouncementSystem | null
  }
}
