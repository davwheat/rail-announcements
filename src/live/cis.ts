import { connectStream, type ConnectionStatus } from './connection'
import type { CISState, Snapshot, Update } from './types'

/** A gap invalidates the view until an authoritative snapshot replaces it. */
export function reduceCIS(state: CISState | null, message: Snapshot | Update): CISState | null {
  if (message.version !== 1) throw new Error('Unsupported CIS version')
  if (message.type === 'snapshot') {
    return {
      station: message.station,
      epoch: message.epoch,
      revision: message.revision,
      window: message.window,
      movements: new Map(message.movements.map(movement => [movement.id, movement])),
      ordering: message.ordering,
      overrides: new Map(message.overrides.map(override => [override.id, override])),
    }
  }
  if (message.type !== 'update') throw new Error('Unexpected CIS message')
  if (!state || message.epoch !== state.epoch || message.previous_revision !== state.revision) return null

  const movements = new Map(state.movements)
  const overrides = new Map(state.overrides)
  for (const id of message.removals) movements.delete(id)
  for (const movement of message.upserts) movements.set(movement.id, movement)
  for (const { id } of message.override_removals) overrides.delete(id)
  for (const override of message.override_upserts) overrides.set(override.id, override)

  return { ...state, revision: message.revision, window: message.window, ordering: message.ordering, movements, overrides }
}

export function connectCIS(url: URL, render: (state: CISState | null) => void, onStatus: (status: ConnectionStatus) => void): () => void {
  let state: CISState | null = null
  let socket: WebSocket | undefined
  let waiting = false
  let responseTimeout: ReturnType<typeof setTimeout> | undefined

  function resync() {
    if (waiting || !socket || socket.readyState !== WebSocket.OPEN) return
    waiting = true
    socket.send(JSON.stringify({ type: 'resync' }))
    responseTimeout = setTimeout(() => socket?.close(), 20_000)
  }

  const disconnect = connectStream(
    url,
    (message, current) => {
      socket = current
      const incoming = message as Snapshot | Update
      if (incoming.type === 'snapshot') {
        waiting = false
        clearTimeout(responseTimeout)
      }
      state = reduceCIS(state, incoming)
      if (!state) resync()
      onStatus(state ? 'live' : 'recovering')
      render(state)
    },
    () => {
      state = null
      socket = undefined
      waiting = false
      clearTimeout(responseTimeout)
      render(null)
    },
    onStatus,
  )

  const timer = setInterval(resync, 60_000 + Math.random() * 10_000)
  return () => {
    clearInterval(timer)
    clearTimeout(responseTimeout)
    disconnect()
  }
}
