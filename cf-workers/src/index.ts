import { Router } from 'itty-router'
import { saveAnnouncementHandler } from './save-announcement'
import { getAnnouncementHandler } from './get-announcement'

export interface Env {
  DB: D1Database
}

const router = Router()

router.post('/save-announcement', saveAnnouncementHandler)
router.get('/get-announcement', getAnnouncementHandler)

router.all('*', () => new Response('', { status: 404 }))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx)
  },
}
