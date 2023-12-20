import { Env } from '.'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

import { v4 as uuid } from 'uuid'
import Ajv from 'ajv'

const ajv = new Ajv()

interface ISystemTabStateJson {
  systemId: string
  tabId: string
  state: Record<string, unknown>
}

const requestSchema = {
  type: 'object',
  properties: {
    systemId: { type: 'string' },
    tabId: { type: 'string' },
    state: { type: 'object' },
  },
  required: ['systemId', 'tabId', 'state'],
  additionalProperties: false,
}

export async function saveAnnouncementHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json()

  const validateRequest = ajv.compile(requestSchema)

  // Validate request body structure
  if (!validateRequest(body)) {
    return new Response(JSON.stringify({ error: true, message: 'Invalid body', detail: validateRequest.errors }), {
      status: 400,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  }

  const { systemId, tabId, state } = body as any as ISystemTabStateJson

  const stateString = JSON.stringify(state)

  // 100kB limit
  if (stateString.length > 100_000) {
    return new Response(JSON.stringify({ error: true, message: 'Tab state too large (>100kB)' }), {
      status: 400,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  }

  const db = env.DB

  // Generate a unique ID for this announcement
  let id = uuid()

  // Ensure the ID is unique
  while ((await db.prepare('SELECT id FROM saved_announcements WHERE id = ? LIMIT 1').bind(id).run()).results.length > 0) {
    id = uuid()
  }

  const result = await db
    .prepare('INSERT INTO saved_announcements (id, system_id, tab_id, state, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, systemId, tabId, stateString, dayjs.utc().toISOString())
    .run()

  if (!result.success) {
    return new Response(JSON.stringify({ error: true, message: 'Failed to save announcement' }), {
      status: 500,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  } else {
    return new Response(JSON.stringify({ error: false, id }), {
      status: 200,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  }
}
