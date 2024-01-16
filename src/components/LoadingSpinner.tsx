import { keyframes } from '@emotion/react'
import React from 'react'

const spin = keyframes({
  from: {
    transform: 'rotate(0)',
  },
  to: {
    transform: 'rotate(1turn)',
  },
})

interface IProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number | string
  inline?: boolean
}

export default function LoadingSpinner({ inline, style, size, className, ...props }: IProps) {
  const Tag = inline ? 'span' : 'div'

  return (
    <Tag
      role="status"
      aria-label="Loading spinner"
      css={[
        {
          '--size': '48px',

          position: 'relative',
          width: 'var(--size)',
          height: 'var(--size)',
          margin: 'auto',
          display: 'inline-block',

          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            left: 0,
            border: 'max(calc(var(--size) * 0.1), 1px) solid black',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: `${spin} infinite 0.75s linear`,
          },
        },
        !inline && {
          display: 'block',
        },
      ]}
      className={className}
      style={
        {
          '--size': typeof size === 'number' ? `${size}px` : size,
          ...style,
        } as any
      }
      {...props}
    />
  )
}
