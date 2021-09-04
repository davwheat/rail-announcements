import React from 'react'

import type { OptionsExplanation } from '@announcement-data/AnnouncementSystem'

interface OptionFieldOptions {
  onChange: (value: any) => void
  value: any
  key: string
  activeState: Record<string, unknown>
}

export default function createOptionField(optionData: OptionsExplanation, options: OptionFieldOptions): JSX.Element {
  switch (optionData.type) {
    case 'boolean':
      return (
        <label key={options.key}>
          <input type="checkbox" checked={options.value} onChange={e => options.onChange(e.currentTarget.checked)} /> {optionData.name}
        </label>
      )

    case 'multiselect':
      return (
        <label key={options.key}>
          {optionData.name}

          <select
            multiple
            value={options.value}
            onChange={e => options.onChange(Array.from(e.currentTarget.selectedOptions).map(el => el.value))}
          >
            {optionData.options.map(option => (
              <option value={option.value} key={option.value}>
                {option.title}
              </option>
            ))}
          </select>

          <p className="helpText">Select multiple options by holding down the CTRL key while clicking. Do the same to deselect an option.</p>
        </label>
      )

    case 'select':
      return (
        <label key={options.key}>
          {optionData.name}

          <select value={options.value} onChange={e => options.onChange(e.currentTarget.value)}>
            {optionData.options.map(option => (
              <option value={option.value} key={option.value}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
      )

    case 'custom':
      const Component = optionData.component
      return <Component key={options.key} onChange={options.onChange} value={options.value} {...optionData.props} />

    case 'customNoState':
      const Component2 = optionData.component
      return <Component2 key={options.key} activeState={options.activeState} {...optionData.props} />
  }
}
