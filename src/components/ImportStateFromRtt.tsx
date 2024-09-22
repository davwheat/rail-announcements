import React, { useState } from 'react'

import ImportIcon from 'mdi-react/ApplicationImportIcon'
import { useHtmlDialog } from 'use-html-dialog'
import { captureException } from '@sentry/gatsby'

import type { RttResponse } from '../../functions/api/get-service-rtt'
import LoadingSpinner from './LoadingSpinner'
import { RttUtils } from '@data/RttUtils'
import { Dayjs } from 'dayjs'

interface IImportStateFromRttProps {
  importStateFromRttService: (rttService: RttResponse, fromLocationIndex: number) => void
  disabled: boolean
}

function latenessString(lateness: number | null) {
  if (lateness === null) return ''
  if (lateness === 0) return 'on time'
  if (lateness > 0) return `${lateness}L`
  return `${Math.abs(lateness)}E`
}

export default function ImportStateFromRtt({ importStateFromRttService, disabled }: IImportStateFromRttProps) {
  const { showModal, props, close } = useHtmlDialog({ resetStyles: true, closeOnOutsideClick: false })
  const [rttUri, setRttUri] = useState('')
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [serviceData, setServiceData] = useState<RttResponse | null>(null)
  const [selectedOriginIndex, setSelectedOriginIndex] = useState<number | null>(null)

  const closeAndReset = () => {
    setImporting(false)
    setErrors([])
    setServiceData(null)
    setRttUri('')
    setSelectedOriginIndex(null)
    close()
  }

  const importService = async () => {
    setImporting(true)
    setErrors([])
    setSelectedOriginIndex(null)

    let uid, date

    // https://www.realtimetrains.co.uk/service/gb-nr:X16032/2024-09-21/detailed
    try {
      const uri = new URL(rttUri)
      if (uri.host !== 'www.realtimetrains.co.uk' && uri.host !== 'realtimetrains.co.uk') {
        setErrors(['Invalid Realtime Trains URL (wrong host)'])
        setImporting(false)
        return
      }

      const uriPath = uri.pathname.split('/')
      if (uriPath.length < 4) {
        setErrors(['Invalid Realtime Trains URL (too few path parameters)'])
        setImporting(false)
        return
      }

      if (uriPath[1] !== 'service') {
        if (uriPath[1] === 'search') {
          setErrors(['This looks like an RTT search link. You need to provide the URL for a particular service into this tool.'])
        } else {
          setErrors(['Invalid Realtime Trains URL (wrong path)'])
        }
        setImporting(false)
        return
      }

      if (uriPath[2].startsWith('gb-nr:')) {
        uid = uriPath[2].substring(6)
      } else {
        setErrors([`Only National Rail services can be imported at this time (tried to import: ${uriPath[2]})`])
        setImporting(false)
        return
      }

      if (!uid.match(/^[A-Z][0-9]{5}$/)) {
        setErrors([`Invalid Realtime Trains URL (invalid UID: ${uid})`])
        setImporting(false)
        return
      }

      date = uriPath[3]
      if (new Date(date).toString() === 'Invalid Date') {
        setErrors([`Invalid Realtime Trains URL (invalid date: ${date})`])
        setImporting(false)
        return
      }
    } catch (e) {
      console.error(e)
      captureException(e, { data: { rttUri } })
      setErrors(['Invalid Realtime Trains URL (error)'])
      setImporting(false)
      return
    }

    const params = new URLSearchParams({
      uid,
      date,
    })
    try {
      const resp = await fetch(
        process.env.NODE_ENV === 'development'
          ? `http://local.davw.network:8787/api/get-service-rtt?${params}`
          : `/api/get-service-rtt?${params}`,
      )

      if (!resp.ok) {
        setErrors([`Failed to fetch Realtime Trains service (HTTP ${resp.status} ${resp.statusText})`])
        setImporting(false)
        return
      }

      const data: { error: true; message: string } | RttResponse = await resp.json()
      if ('error' in data) {
        setErrors([`API error: ${data.message}`])
        setImporting(false)
        return
      }

      console.log(data)
      setServiceData(data)
      setImporting(false)
    } catch (e) {
      console.error(e)
      captureException(e, { data: { rttUri } })

      if (e instanceof Error) {
        setErrors([`Failed to fetch Realtime Trains service (${e.message})`])
      } else {
        setErrors(['Failed to fetch Realtime Trains service (unknown error)'])
      }
      setImporting(false)
      return
    }
  }

  const selectOriginLocation = (index: number) => {
    importStateFromRttService(serviceData!, index)
    closeAndReset()
  }

  return (
    <>
      <button className="outlined" disabled={disabled} onClick={showModal}>
        <span className="buttonLabel">
          <ImportIcon />
          Import details from Realtime Trains
        </span>
      </button>

      <dialog
        {...props}
        css={{
          '&[open]': {
            width: '100%',
            height: '100%',
            margin: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        <article
          css={{
            width: '100%',
            maxHeight: 'calc(100% - 48px)',
            maxWidth: 720,
            margin: '0 auto',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <header
            css={{
              padding: '24px 24px 0 24px',
            }}
          >
            <h1>
              {!serviceData && 'Import service from Realtime Trains'}
              {serviceData && 'Select your origin location'}
            </h1>
          </header>

          <main
            css={{
              overflow: 'auto',
              padding: '0 24px',
            }}
          >
            <div
              css={{
                padding: 12,
                paddingLeft: 16,
                borderLeft: '4px solid var(--primary-blue)',
                background: `color-mix(in srgb, var(--primary-blue), transparent 92%)`,
                marginBottom: 24,
              }}
            >
              <p css={{ marginBottom: 0 }}>
                This feature is currently in beta. If you encounter issues, please report them on{' '}
                <a target="_blank" href="https://github.com/davwheat/rail-announcements/issues/270">
                  this GitHub tracking issue
                </a>
                .
              </p>
            </div>

            <div
              css={{
                position: 'relative',
                marginBottom: 24,
              }}
            >
              <div
                css={{
                  opacity: importing ? 0.5 : 1,
                }}
              >
                {errors.length > 0 && (
                  <div
                    css={{
                      padding: 12,
                      paddingLeft: 16,
                      borderLeft: '4px solid var(--primary-red)',
                      background: `color-mix(in srgb, var(--primary-red), transparent 92%)`,
                      marginBottom: 24,
                      marginTop: 24,
                    }}
                  >
                    {errors.map((error, i) => (
                      <p key={i} css={{ margin: 0 }}>
                        {error}
                      </p>
                    ))}
                  </div>
                )}

                {!serviceData && (
                  <label>
                    Realtime Trains service URL
                    <input
                      className="textInput"
                      disabled={importing}
                      type="text"
                      placeholder="https://www.realtimetrains.co.uk/service/gb-nr:X16032/2024-09-21"
                      required
                      value={rttUri}
                      onChange={e => setRttUri(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          importService()
                        }
                      }}
                    />
                  </label>
                )}

                {serviceData &&
                  (() => {
                    const locations = RttUtils.getEligibleLocations(serviceData)

                    if (locations.length === 0) {
                      return (
                        <>
                          <div
                            css={{
                              padding: 12,
                              paddingLeft: 16,
                              borderLeft: '4px solid var(--primary-red)',
                              background: `color-mix(in srgb, var(--primary-red), transparent 92%)`,
                              marginBottom: 24,
                              marginTop: 24,
                            }}
                          >
                            <p>There are no public call locations for this service.</p>
                            <p>Please try again with another service URL.</p>
                            <button
                              onClick={() => {
                                setServiceData(null)
                                setRttUri('')
                              }}
                            >
                              Go back
                            </button>
                          </div>
                        </>
                      )
                    }

                    return (
                      <ul css={{ margin: 0 }}>
                        {locations.map((location, i, arr) => {
                          console.log(location)

                          let schedArr: Dayjs | null = null
                          try {
                            schedArr = RttUtils.getScheduledArrivalTime(serviceData, i)
                          } catch (e) {
                            console.warn(e)
                          }

                          let realArr: Dayjs | null = null
                          try {
                            realArr = RttUtils.getRealtimeArrivalTime(serviceData, i)
                          } catch (e) {
                            console.warn(e)
                          }

                          let schedDep: Dayjs | null = null
                          try {
                            schedDep = RttUtils.getScheduledDepartureTime(serviceData, i)
                          } catch (e) {
                            console.warn(e)
                          }

                          let realDep: Dayjs | null = null
                          try {
                            realDep = RttUtils.getRealtimeDepartureTime(serviceData, i)
                          } catch (e) {
                            console.warn(e)
                          }

                          const isSetDownOnly = schedDep === null && i !== arr.length - 1
                          const isPickUpOnly = schedArr === null && i !== 0

                          return (
                            <li
                              key={location.randomId}
                              css={{
                                '--track-color': 'var(--primary-blue)',
                                '--track-gap': '24px',
                                '--track-line-weight': '6px',
                                '--circle-radius': 'calc(var(--track-line-weight) * 1.75)',

                                '& label::before, & label::after': {
                                  pointerEvents: 'none',
                                },

                                '& label::before': {
                                  content: '""',
                                  width: 'var(--track-line-weight)',
                                  background: 'var(--track-color)',
                                  position: 'absolute',
                                  left: 'calc(-1 * var(--track-gap))',
                                  top: 'calc(-1 * var(--item-spacing))',
                                  bottom: 'calc(-1 * var(--item-spacing))',
                                },

                                '&:first-of-type label::before': {
                                  top: 'calc(50% - var(--circle-radius))',
                                },

                                '&:last-of-type label::before': {
                                  bottom: 'calc(50% - var(--circle-radius))',
                                },

                                '& label::after': {
                                  content: '""',
                                  height: 'var(--track-line-weight)',
                                  width: 'calc(var(--track-gap) / 2)',
                                  background: 'var(--track-color)',
                                  position: 'absolute',
                                  left: 'calc(-1 * var(--track-gap) + var(--track-line-weight))',
                                  top: 'calc(50% - var(--track-line-weight) / 2)',
                                },

                                '&:first-of-type label::after, &:last-of-type label::after': {
                                  left: 'calc(-1 * var(--track-gap) - var(--circle-radius) + var(--track-line-weight) / 2)',
                                  height: 'calc(var(--circle-radius) * 2)',
                                  width: 'calc(var(--circle-radius) * 2)',
                                  borderRadius: '50%',
                                },

                                '&:first-of-type label::after': {
                                  top: 'calc(50% - var(--circle-radius))',
                                },
                                '&:last-of-type label::after': {
                                  top: 'calc(50% - var(--circle-radius))',
                                },
                              }}
                            >
                              <label
                                htmlFor={`originLocation-${i}`}
                                css={{
                                  '--item-spacing': '8px',
                                  marginLeft: 'var(--track-gap)',
                                  display: 'grid',
                                  gridTemplateAreas: `
                                    "radio arr location"
                                    "radio dep detail"
                                  `,
                                  gridTemplateColumns: '24px 10ch 1fr',
                                  gap: '8px 16px',
                                  // center
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  padding: 12,
                                  border: '2px solid #ddd',
                                  marginTop: 'var(--item-spacing)',
                                  marginBottom: 'var(--item-spacing)',
                                  position: 'relative',

                                  '&:has(input:checked)': {
                                    borderColor: 'var(--primary-blue)',
                                    background: `color-mix(in srgb, var(--primary-blue), transparent 92%)`,
                                  },
                                }}
                              >
                                <input
                                  type="radio"
                                  name="originLocation"
                                  id={`originLocation-${i}`}
                                  checked={selectedOriginIndex === i}
                                  onChange={() => setSelectedOriginIndex(i)}
                                  css={{ gridArea: 'radio', height: 24, width: 24, margin: 0 }}
                                />
                                <div
                                  css={{
                                    gridArea: 'arr',

                                    '& span': {
                                      display: 'inline-block',
                                      width: '50%',
                                    },

                                    '&:has(span + span:not(:empty)) span:first-of-type': {
                                      color: 'red',
                                      textDecoration: 'line-through',
                                    },
                                  }}
                                >
                                  <span>{schedArr?.format('HH:mm')}</span>
                                  <span>{realArr !== null && schedArr !== null && realArr > schedArr && realArr?.format('HH:mm')}</span>
                                </div>
                                <div
                                  css={{
                                    gridArea: 'dep',

                                    '& span': {
                                      display: 'inline-block',
                                      width: '50%',
                                    },

                                    '&:has(span + span:not(:empty)) span:first-of-type': {
                                      color: 'red',
                                      textDecoration: 'line-through',
                                    },
                                  }}
                                >
                                  <span>{schedDep?.format('HH:mm')}</span>
                                  <span>{realDep !== null && schedDep !== null && realDep > schedDep && realDep?.format('HH:mm')}</span>
                                </div>
                                <div css={{ gridArea: 'location' }}>{location.name}</div>
                                <div css={{ gridArea: 'detail', color: '#888', fontWeight: 'normal', fontSize: '0.8em' }}>
                                  {[
                                    location.rttPlatform && `Platform ${location.rttPlatform}`,
                                    !isSetDownOnly && location.depLateness && `Departed ${latenessString(location.depLateness)}`,
                                    isPickUpOnly && location.arrLateness && `Arrived ${latenessString(location.arrLateness)}`,
                                    isSetDownOnly && 'Set down only',
                                    isPickUpOnly && 'Pick up only',
                                  ]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </div>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )
                  })()}
              </div>
              {importing && (
                <div css={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <LoadingSpinner />
                </div>
              )}
            </div>
          </main>

          <footer
            css={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
              justifyContent: 'space-between',
              width: '100%',
              padding: '0 24px 24px 24px',
            }}
          >
            <button className="outlined" onClick={closeAndReset}>
              Cancel
            </button>
            <button
              disabled={serviceData ? selectedOriginIndex === null : importing}
              onClick={serviceData ? () => selectOriginLocation(selectedOriginIndex!!) : importService}
            >
              {!serviceData && 'Lookup service'}
              {serviceData && 'Import details'}
            </button>
          </footer>
        </article>
      </dialog>
    </>
  )
}
