import { Router, error } from 'itty-router'
import { createCors } from 'itty-cors'

import { saveAnnouncementHandler } from './save-announcement'
import { getAnnouncementHandler } from './get-announcement'
import { getServicesHandler } from './get-services'
import { getRttServiceHandler } from './get-service-rtt'

export interface Env {
  DB: D1Database

  RTT_API_PASSWORD: string
  RTT_API_USERNAME: string
}

const { preflight, corsify } = createCors({ origins: ['*'] })

const router = Router()

router.all('*', preflight)

router.post('/save-announcement', saveAnnouncementHandler)
router.get('/get-announcement', getAnnouncementHandler)
router.get('/get-services', getServicesHandler)
router.get('/get-service-rtt', getRttServiceHandler)

router.all('*', () => error(404))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router
      .handle(request, env, ctx)
      .then(corsify)
      .catch(err => error(500, err.stack))
      .then(corsify)
  },
}
