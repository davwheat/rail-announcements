import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import Select from 'react-select'
import { nanoid } from 'nanoid'
import { getStationByCrs } from '@data/StationManipulators'

interface Option {
  readonly label: string
  readonly value: string
}

export type IAlternativeServicesState = {
  randomId: string
  passengersFor: {
    crsCode: string
    name: string
    randomId: string
  }[]
  service: {
    hour: string
    minute: string
    terminatingCrs: string
    via: string | 'none'
    platform: string
  }
}[]

interface ICallingAtSelectorProps {
  value: IAlternativeServicesState
  onChange: (newValue: IAlternativeServicesState) => void
  availableStations: { high: string[]; low: string[] }
  hours: string[]
  mins: string[]
  platforms: string[]
}

function AtosDisruptionAlternatives({ onChange, value, availableStations, hours, mins, platforms }: ICallingAtSelectorProps): JSX.Element {
  const firstTerminatingStation = availableStations.low[0]

  return (
    <>
      <button
        onClick={() => {
          value.push({
            passengersFor: [],
            randomId: nanoid(),
            service: {
              hour: hours[0],
              minute: mins[0],
              terminatingCrs: firstTerminatingStation,
              platform: platforms[0],
              via: 'none',
            },
          })

          onChange(value)
        }}
      >
        Add alternative service
      </button>

      <div
        css={{
          marginTop: 12,
        }}
      >
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
          <Droppable droppableId="disruptionAlternatives">
            {(provided, snapshot) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {value.map((alternateService, i) => {
                  return (
                    <Draggable key={alternateService.randomId} draggableId={alternateService.randomId} index={i}>
                      {(provided, snapshot) => (
                        <div
                          css={{
                            marginBottom: 24,
                          }}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <AtosDisruptionAlternativeServicePanel
                            value={alternateService}
                            onRemove={() => {
                              value.splice(i, 1)
                              onChange(value)
                            }}
                            onChange={(newState: IAlternativeServicesState[number]) => {
                              value[i] = newState
                              onChange(value)
                            }}
                            availableStations={availableStations}
                            hours={hours}
                            mins={mins}
                            platforms={platforms}
                          />
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
      </div>
    </>
  )
}

interface IAtosDisruptionAlternativeServicePanelProps {
  value: IAlternativeServicesState[number]
  onChange: (newValue: IAlternativeServicesState[number]) => void
  onRemove: () => void
  availableStations: { high: string[]; low: string[] }
  hours: string[]
  mins: string[]
  platforms: string[]
}
function AtosDisruptionAlternativeServicePanel({
  value,
  onChange,
  onRemove,
  availableStations,
  hours,
  mins,
  platforms,
}: IAtosDisruptionAlternativeServicePanelProps): JSX.Element {
  return (
    <div
      css={{
        padding: 16,
        paddingBottom: 8,

        background: '#fff',

        '& > label': {
          paddingTop: 0,
        },
      }}
    >
      <div
        css={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <p>Passengers for...</p>

        <button
          css={{
            boxSizing: 'content-box',
            padding: 8,
            display: 'inline-block',
            height: '1em',
            marginLeft: 8,
          }}
          onClick={onRemove}
        >
          <svg
            viewBox="0 0 24 24"
            css={{
              height: '1em',
            }}
          >
            <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
          </svg>
        </button>
      </div>

      <Select<Option, false>
        css={{
          marginBottom: 8,
          maxWidth: 400,
        }}
        value={{
          value: 'none',
          label: 'Select station…',
        }}
        onChange={val => {
          const stn = getStationByCrs(val!!.value)
          value.passengersFor.push({ crsCode: stn!!.crsCode, name: stn!!.stationName, randomId: nanoid() })
          onChange(value)
        }}
        options={[
          {
            value: 'none',
            label: 'Select station…',
          },
        ].concat(
          availableStations.high
            .filter(stn => !value.passengersFor.map(x => x.crsCode).includes(stn))
            .sort()
            .map(s => {
              if (!getStationByCrs(s)) {
                console.warn('No station found for', s)

                return {
                  value: s,
                  label: s,
                }
              }

              return {
                value: s,
                label: getStationByCrs(s)!!.stationName,
              }
            }),
        )}
      />

      <DragDropContext
        onDragEnd={result => {
          if (!result.destination) return

          const { source, destination } = result

          const tempState = value
          const movedItem = tempState.passengersFor[source.index]

          tempState.passengersFor.splice(source.index, 1)
          tempState.passengersFor.splice(destination.index, 0, movedItem)

          onChange(tempState)
        }}
      >
        <Droppable droppableId="disruptionAlternatives">
          {(provided, snapshot) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {value.passengersFor.map((stop, i) => {
                return (
                  <Draggable key={stop.randomId} draggableId={stop.randomId} index={i}>
                    {(provided, snapshot) => (
                      <div
                        css={{
                          border: '1px solid black',
                          padding: '4px 8px',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <span>{stop.name}</span>{' '}
                        <button
                          css={{
                            boxSizing: 'content-box',
                            padding: 8,
                            display: 'inline-block',
                            height: '1em',
                            marginLeft: 8,
                          }}
                          onClick={() => {
                            const newFor = value.passengersFor.filter(s => s.randomId !== stop.randomId)
                            value.passengersFor = newFor
                            onChange(value)
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            css={{
                              height: '1em',
                            }}
                          >
                            <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
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

      <p>Should get the...</p>

      <label>
        Hour
        <select
          value={value.service.hour}
          onChange={e => {
            value.service.hour = e.target.value
            onChange(value)
          }}
        >
          {hours.map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Minute
        <select
          value={value.service.minute}
          onChange={e => {
            value.service.minute = e.target.value
            onChange(value)
          }}
        >
          {mins.map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Terminating at
        <select
          value={value.service.terminatingCrs}
          onChange={e => {
            value.service.terminatingCrs = e.target.value
            onChange(value)
          }}
        >
          {(value.service.via !== 'none' ? availableStations.high : availableStations.low).map(option => (
            <option value={option} key={option}>
              {getStationByCrs(option).stationName}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={value.service.via !== 'none'}
          onChange={e => {
            value.service.via = e.target.checked ? availableStations.low[0] : 'none'
            const dataset = e.target.checked ? availableStations.high : availableStations.low

            if (!dataset.some(x => x === value.service.terminatingCrs)) value.service.terminatingCrs = dataset[0]

            onChange(value)
          }}
        />
        Via?
      </label>

      {value.service.via !== 'none' && (
        <label>
          Via station
          <select
            value={value.service.via}
            onChange={e => {
              value.service.via = e.target.value
              onChange(value)
            }}
          >
            {availableStations.low.map(option => (
              <option value={option} key={option}>
                {getStationByCrs(option).stationName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Platform
        <select
          value={value.service.platform}
          onChange={e => {
            value.service.platform = e.target.value
            onChange(value)
          }}
        >
          {platforms.map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default AtosDisruptionAlternatives
