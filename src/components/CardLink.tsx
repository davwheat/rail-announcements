import React from 'react'

import { Link } from 'gatsby'

interface ICardLinkProps {
  title: React.ReactNode
  description?: React.ReactNode
  to: string
  className?: string
}

const CARD_PADDING = 16 as const

function CardLink({ title, description, to, className }: ICardLinkProps) {
  return (
    <Link
      className={className}
      to={to}
      css={{
        textDecoration: 'none !important',
        display: 'flex',
        border: '2px solid black',
        outline: '0px solid black',
        background: 'white',

        '&:hover, &:focus, &:active': {
          outlineWidth: 2,
          '& $arrow': {
            '&::after': {
              transform: 'translateX(3px) scaleY(0.92) scaleX(1.05) rotate(45deg)',
            },
          },
        },
      }}
    >
      <article
        css={{
          display: 'flex',
          flexDirection: 'column',
          padding: CARD_PADDING,
          position: 'relative',
          flexGrow: 1,
        }}
      >
        <header
          css={{
            display: 'flex',
            gap: 8,
          }}
        >
          <h3
            css={[
              {
                flexGrow: 1,
              },
              !description && {
                marginBottom: 0,
              },
            ]}
          >
            {title}
          </h3>
        </header>

        {description && (
          <>
            <div
              aria-hidden
              css={{
                flexGrow: 1,
              }}
            />
            <p>{description}</p>
          </>
        )}
      </article>

      <div
        role="presentation"
        aria-hidden="true"
        css={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '10px 18px',
          paddingRight: 20,
          gap: 8,
          transformOrigin: 'center',
          '&::after': {
            content: '""',
            display: 'inline-block',
            width: '0.75em',
            height: '0.75em',
            borderTop: '2px solid currentColor',
            borderRight: '2px solid currentColor',
            transform: 'rotate(45deg)',
          },
        }}
      />
    </Link>
  )
}

export default CardLink
