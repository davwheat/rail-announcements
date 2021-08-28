import React from 'react'

import { makeStyles } from '@material-ui/styles'
import getActiveSystem from '@helpers/getActiveSystem'
import createOptionField from '@helpers/createOptionField'
import { AllStationsTitleValueMap, getStationByCrs } from '@data/StationManipulators'

import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import { nanoid } from 'nanoid'

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

interface IOptionsState {
  callingAtStops: { crsCode: string; name: string; randomId: string }[]
  thisStationCode: string
  terminatingStationCode: string
  [key: string]: any
}

function StoppedAtStationPane(): JSX.Element {
  const classes = useStyles()

  const AnnouncementSystem = getActiveSystem()
  if (!AnnouncementSystem) return null
  const AnnouncementSystemInstance = new AnnouncementSystem()

  const AvailableLowStations = React.useMemo(
    () => AllStationsTitleValueMap.filter(s => AnnouncementSystemInstance.AvailableStationNames.low.includes(s.value)),
    [AnnouncementSystem, AllStationsTitleValueMap],
  )

  const AvailableHighStations = React.useMemo(
    () => AllStationsTitleValueMap.filter(s => AnnouncementSystemInstance.AvailableStationNames.high.includes(s.value)),
    [AnnouncementSystem, AllStationsTitleValueMap],
  )

  const opts = AnnouncementSystemInstance.stoppedAtStationAnnouncementOptions
  const standardOptions = {
    thisStationCode: AvailableLowStations[0].value,
    terminatingStationCode: AvailableLowStations[0].value,
    callingAtStops: [],
  }

  const [optionsState, setOptionsState] = React.useState<IOptionsState>(
    Object.entries(opts).reduce((acc, [key, opt]) => ({ ...acc, [key]: opt.default }), standardOptions),
  )
  const [isDisabled, setIsDisabled] = React.useState(false)

  function createFieldUpdater(field: string): (value) => void {
    return (value): void => {
      if (isDisabled) return

      setOptionsState(prevState => ({ ...prevState, [field]: value }))
    }
  }

  return (
    <div className={classes.root}>
      {isDisabled && (
        <p className={classes.disabledMessage}>
          <strong>All options are disabled while an announcement is playing.</strong>
        </p>
      )}
      <fieldset>
        <h3>Standard options</h3>

        {createOptionField(
          {
            name: 'Station',
            default: AvailableLowStations[0].value,
            type: 'select',
            options: AvailableLowStations,
          },
          { onChange: createFieldUpdater('thisStationCode'), value: optionsState.thisStationCode, key: 'thisStationCode' },
        )}

        {createOptionField(
          {
            name: 'Terminates at',
            default: AvailableLowStations[0].value,
            type: 'select',
            options: AvailableLowStations,
          },
          { onChange: createFieldUpdater('terminatingStationCode'), value: optionsState.terminatingStationCode, key: 'terminatingStationCode' },
        )}

        {optionsState.thisStationCode !== optionsState.terminatingStationCode ? (
          <>
            {createOptionField(
              {
                name: 'Intermediary stops',
                default: AvailableHighStations[0].value,
                type: 'select',
                options: [{ value: '', title: 'Add a calling point...' }, ...AvailableHighStations],
              },
              {
                onChange: newStop => {
                  setOptionsState(state => ({
                    ...state,
                    callingAtStops: [
                      ...state.callingAtStops,
                      { crsCode: newStop, name: getStationByCrs(newStop).stationName, randomId: nanoid() },
                    ],
                  }))
                },
                value: '',
                key: 'intermediaryStationCode',
              },
            )}

            <div className={classes.callingAtRoot}>
              <label>Calling at...</label>
              {optionsState.callingAtStops.length > 0 && (
                <DragDropContext
                  onDragEnd={result => {
                    if (!result.destination) return

                    const { source, destination } = result

                    const tempState = optionsState.callingAtStops
                    const movedItem = tempState[source.index]

                    tempState.splice(source.index, 1)
                    tempState.splice(destination.index, 0, movedItem)

                    createFieldUpdater('callingAtStops')(tempState)
                  }}
                >
                  <Droppable droppableId="callingAtStops">
                    {(provided, snapshot) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {optionsState.callingAtStops.map((stop, i) => {
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
                                      createFieldUpdater('callingAtStops')(optionsState.callingAtStops.filter(s => s.randomId !== stop.randomId))
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
        ) : (
          <p className={classes.disabledMessage}>
            <strong>To add calling points, the termination station must not be the same as the current station.</strong>
          </p>
        )}
      </fieldset>

      <fieldset>
        <h3>Custom options</h3>

        {Object.keys(opts).length === 0 && <p>No options</p>}

        <>
          {Object.entries(opts).map(([key, opt]) =>
            createOptionField(opt, { onChange: createFieldUpdater(key), value: optionsState[key], key }),
          )}
        </>
      </fieldset>
      <button
        onClick={async () => {
          const { callingAtStops, thisStationCode, terminatingStationCode, ...otherOptions } = optionsState

          if (callingAtStops[callingAtStops.length - 1]?.crsCode === terminatingStationCode) {
            alert(
              `The last intermediary stop (${callingAtStops[callingAtStops.length - 1]?.name}) cannot be the same as the terminating station.`,
            )
            return
          }

          setIsDisabled(true)

          await AnnouncementSystemInstance.playStoppedAtStationAnnouncement(
            thisStationCode,
            terminatingStationCode,
            callingAtStops.map(s => s.crsCode),
            { ...otherOptions } as any,
          )

          setIsDisabled(false)
        }}
      >
        Play announcement
      </button>
    </div>
  )
}

export default StoppedAtStationPane
