import React from 'react'

import { makeStyles } from '@material-ui/styles'

import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import createOptionField from '@helpers/createOptionField'
import { nanoid } from 'nanoid'
import { AllStationsTitleValueMap, getStationByCrs } from '@data/StationManipulators'

const useStyles = makeStyles({
  root: {
    padding: 16,
    backgroundColor: '#eee',
  },
  disabledMessage: {
    background: 'rgba(255, 0, 0, 0.15)',
    borderLeft: '#f00 4px solid',
    padding: '8px 16px',
  },
  callingAtRoot: {
    padding: 16,
    paddingBottom: 8,
    marginBottom: 24,

    background: '#fff',

    '& > label': {
      paddingTop: 0,
    },
  },
  draggableItem: {
    border: '1px solid black',
    padding: '4px 8px',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',

    '& > button': {
      boxSizing: 'content-box',
      padding: 8,
      display: 'inline-block',
      height: '1em',
      marginLeft: 8,

      '& > svg': {
        height: '1em',
      },
    },
  },
})

interface ICallingAtSelectorProps {
  value: { crsCode: string; name: string; randomId: string }[]
  onChange: (newValue: { crsCode: string; name: string; randomId: string }[]) => void
  availableStations: string[]
}

function CallingAtSelector({ onChange, value, availableStations }: ICallingAtSelectorProps): JSX.Element {
  const classes = useStyles()

  const AvailableStations = React.useMemo(
    () => AllStationsTitleValueMap.filter(s => availableStations.includes(s.value)),
    [availableStations, AllStationsTitleValueMap],
  )

  return (
    <>
      {createOptionField(
        {
          name: 'Intermediary stops',
          default: AvailableStations[0].value,
          type: 'select',
          options: [{ value: '', title: 'Add a calling point...' }, ...AvailableStations],
        },
        {
          onChange: newStop => {
            onChange([...value, { crsCode: newStop, name: getStationByCrs(newStop).stationName, randomId: nanoid() }])
          },
          value: '',
          key: 'intermediaryStationCode',
        },
      )}

      <div className={classes.callingAtRoot}>
        <label>Calling at... (excluding terminating station)</label>
        {value.length > 0 && (
          <DragDropContext
            onDragEnd={result => {
              if (!result.destination) return

              const { source, destination } = result

              const tempState = value
              const movedItem = tempState[source.index]

              tempState.splice(source.index, 1)
              tempState.splice(destination.index, 0, movedItem)

              onChange(tempState)
            }}
          >
            <Droppable droppableId="callingAtStops">
              {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {value.map((stop, i) => {
                    return (
                      <Draggable key={stop.randomId} draggableId={stop.randomId} index={i}>
                        {(provided, snapshot) => (
                          <div
                            className={classes.draggableItem}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <span>{stop.name}</span>{' '}
                            <button
                              onClick={() => {
                                onChange(value.filter(s => s.randomId !== stop.randomId))
                              }}
                            >
                              <svg viewBox="0 0 24 24">
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
