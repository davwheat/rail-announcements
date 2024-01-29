import React from 'react'

import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import createOptionField from '@helpers/createOptionField'
import { nanoid } from 'nanoid'
import { AllStationsTitleValueMap } from '@data/StationManipulators'

export interface CallingAtPoint {
  crsCode: string
  name: string
  randomId: string
  shortPlatform?: string
  requestStop?: boolean
  splitType?: 'none' | 'splits' | 'splitTerminates'
  splitForm?: string
  splitCallingPoints?: CallingAtPoint[]
}

export interface ICallingAtSelectorProps {
  className?: string
  value: CallingAtPoint[]
  onChange: (newValue: CallingAtPoint[]) => void
  availableStations: string[]
  additionalOptions?: { title: string; value: string }[]
  selectLabel?: string
  placeholder?: string
  heading?: string
  /**
   * If false, short platforms will be disabled. If an array, only the specified coach counts will be enabled.
   */
  enableShortPlatforms?: false | { title: string; value: string }[]
  /**
   * Whether request stops are enabled.
   */
  enableRequestStops?: boolean
  /**
   * If false, splits and joins will be disabled. If an array, only the specified coach counts (for detachments) will be enabled.
   */
  enableSplits?: false | { title: string; value: string }[]
}

function CallingAtSelector({
  onChange,
  value,
  availableStations,
  additionalOptions,
  selectLabel = 'Intermediary stops',
  placeholder = 'Add a calling point…',
  heading = 'Calling at... (excluding terminating station)',
  enableShortPlatforms = false,
  enableRequestStops = false,
  enableSplits = false,
  className,
}: ICallingAtSelectorProps): JSX.Element {
  const AvailableStations = React.useMemo(() => {
    const options = AllStationsTitleValueMap.filter(s => availableStations.includes(s.value))

    if (additionalOptions) {
      options.push(...additionalOptions)
      options.sort((a, b) => a.title.localeCompare(b.title))

      return options
    }

    return options
  }, [availableStations, AllStationsTitleValueMap])

  return (
    <>
      {createOptionField(
        {
          name: selectLabel,
          default: AvailableStations[0].value,
          type: 'select',
          options: [{ value: '', title: placeholder }, ...AvailableStations],
        },
        {
          onChange: newStop => {
            onChange([
              ...value,
              {
                crsCode: newStop,
                name: AvailableStations.find(s => s.value === newStop)!!.title,
                randomId: nanoid(),
              },
            ])
          },
          value: '',
          key: 'intermediaryStationCode',
        },
      )}

      <div
        className={className}
        css={{
          padding: 16,
          paddingBottom: 8,
          marginBottom: 24,

          background: '#fff',

          '& > label': {
            paddingTop: 0,
          },
        }}
      >
        <label>{heading}</label>
        {value.length > 0 && (
          <DragDropContext
            onDragEnd={result => {
              if (!result.destination) return

              const { source, destination } = result

              const tempState = [...value]
              const movedItem = tempState[source.index]

              tempState.splice(source.index, 1)
              tempState.splice(destination.index, 0, movedItem)

              onChange(tempState)
            }}
          >
            <Droppable droppableId="callingAtStops">
              {provided => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {value.map((stop, i) => {
                    return (
                      <Draggable key={stop.randomId} draggableId={stop.randomId} index={i}>
                        {provided => (
                          <div
                            css={{
                              border: '1px solid black',
                              padding: '4px 8px',
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <div
                              css={{
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '4px 0',
                                gap: 8,

                                '& > :not(:first-of-type)': {
                                  fontSize: 18,
                                },

                                '& > *': {
                                  padding: 0,
                                },
                              }}
                            >
                              <span>{stop.name}</span>

                              {enableShortPlatforms &&
                                createOptionField(
                                  {
                                    default: 'none',
                                    options: [{ value: '', title: 'No' }].concat(enableShortPlatforms),
                                    name: 'Short platform',
                                    type: 'select',
                                  },
                                  {
                                    value: stop.shortPlatform || '',
                                    key: 'shortPlatform',
                                    onChange(v) {
                                      onChange(value.map(s => (s.randomId === stop.randomId ? { ...s, shortPlatform: v } : s)))
                                    },
                                  },
                                )}

                              {enableRequestStops &&
                                createOptionField(
                                  {
                                    default: false,
                                    name: 'Request stop',
                                    type: 'boolean',
                                  },
                                  {
                                    value: stop.requestStop || false,
                                    key: 'requestStop',
                                    onChange(v) {
                                      onChange(value.map(s => (s.randomId === stop.randomId ? { ...s, requestStop: v } : s)))
                                    },
                                  },
                                )}

                              {enableSplits && (
                                <>
                                  {createOptionField(
                                    {
                                      default: 'none',
                                      name: 'Splits?',
                                      type: 'select',
                                      options: [
                                        { value: 'none', title: 'None' },
                                        { value: 'splits', title: 'Divides here' },
                                        { value: 'splitTerminates', title: 'Divides and terminates' },
                                      ],
                                    },
                                    {
                                      value: stop.splitType || 'none',
                                      key: 'splitType',
                                      onChange(v) {
                                        onChange(value.map(s => (s.randomId === stop.randomId ? { ...s, splitType: v } : s)))
                                      },
                                    },
                                  )}
                                  {createOptionField(
                                    {
                                      default: 'none',
                                      name: 'Split formation',
                                      type: 'select',
                                      options: enableSplits,
                                      onlyShowWhen(activeState) {
                                        return activeState.splitType !== 'none' && activeState.splitType !== undefined
                                      },
                                    },
                                    {
                                      value: stop.splitForm || enableSplits[0].value,
                                      key: 'splitForm',
                                      onChange(v) {
                                        onChange(value.map(s => (s.randomId === stop.randomId ? { ...s, splitForm: v } : s)))
                                      },
                                      activeState: stop as any,
                                    },
                                  )}

                                  {stop.splitType === 'splits' && <hr />}

                                  {createOptionField(
                                    {
                                      default: [],
                                      name: '',
                                      type: 'custom',
                                      component: CallingAtSelector as any,
                                      props: {
                                        availableStations: availableStations,
                                        additionalOptions: additionalOptions,
                                        selectLabel: 'Split calling points',
                                        placeholder: 'Add a split calling point…',
                                        heading: 'Calling points (INCLUDING terminating station)',
                                        enableShortPlatforms: enableShortPlatforms,
                                        enableRequestStops: enableRequestStops,
                                        enableSplits: false,
                                      },
                                      onlyShowWhen(activeState) {
                                        return activeState.splitType === 'splits'
                                      },
                                    },
                                    {
                                      value: stop.splitCallingPoints || [],
                                      key: 'splitCallingPoints',
                                      onChange(v) {
                                        onChange(value.map(s => (s.randomId === stop.randomId ? { ...s, splitCallingPoints: v } : s)))
                                      },
                                      activeState: stop as any,
                                    },
                                  )}
                                </>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                onChange(value.filter(s => s.randomId !== stop.randomId))
                              }}
                              css={{
                                boxSizing: 'content-box',
                                padding: 8,
                                display: 'inline-block',
                                height: '1em',
                                marginLeft: 'auto',
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                css={{
                                  height: '1em',
                                }}
                              >
                                <path
                                  fill="currentColor"
                                  d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </>
  )
}

export default CallingAtSelector
