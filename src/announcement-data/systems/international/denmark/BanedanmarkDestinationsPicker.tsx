import React from 'react'

import createOptionField from '@helpers/createOptionField'

interface IProps {
  value: string[]
  onChange: (value: string[]) => void
  options: { title: string; value: string }[]
  max?: number
}

/**
 * Ordered picker for 1–3 destinations. The list is a single array, so removing a stop shifts the
 * later ones up rather than leaving a gap.
 */
export default function BanedanmarkDestinationsPicker({ value, onChange, options, max = 3 }: IProps) {
  const destinations = Array.isArray(value) && value.length > 0 ? value : [options[0].value]

  const setAt = (index: number, newValue: string) => onChange(destinations.map((d, i) => (i === index ? newValue : d)))
  const removeAt = (index: number) => onChange(destinations.filter((_, i) => i !== index))
  const add = () => onChange([...destinations, options[0].value])

  return (
    <>
      {destinations.map((destination, i) => (
        <div key={i} css={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div css={{ flexGrow: 1 }}>
            {createOptionField(
              {
                name: i === 0 ? 'Destination' : `Destination ${i + 1}`,
                type: 'select',
                default: options[0].value,
                options,
              },
              {
                value: destination,
                onChange: v => setAt(i, v),
                key: `destination-${i}`,
              },
            )}
          </div>
          {destinations.length > 1 && (
            <button type="button" className="danger" onClick={() => removeAt(i)}>
              <span className="buttonLabel">Remove</span>
            </button>
          )}
        </div>
      ))}

      {destinations.length < max && (
        <button type="button" className="outlined" css={{ marginTop: 4 }} onClick={add}>
          <span className="buttonLabel">Add destination</span>
        </button>
      )}
    </>
  )
}
