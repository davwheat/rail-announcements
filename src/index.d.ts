// Allow imports of .svg files by URL
declare module '*.svg' {
  const content: string
  export default content
}

// Allow imports of .inline.svg files as React components
declare module '*.inline.svg' {
  import React = require('react')
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  const src: string
  export default src
}
