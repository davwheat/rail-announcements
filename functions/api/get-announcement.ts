export const onRequest: PagesFunction<Env> = async context => {
  const { request, env } = context
  const { searchParams } = new URL(request.url)

  // Validate request body structure
  if (!searchParams.has('id')) {
    return new Response(JSON.stringify({ error: true, message: 'No announcement ID provided' }), {
      status: 400,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  }
  const db = env.DB

  const id = searchParams.get('id')

  const result = await db.prepare('SELECT * FROM saved_announcements WHERE id = ? LIMIT 1').bind(id).all()

  if (!result.success) {
    return new Response(JSON.stringify({ error: true, message: 'Failed to get announcement' }), {
      status: 500,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  } else if (result.results.length === 0) {
    return new Response(JSON.stringify({ error: true, message: 'Announcement not found' }), {
      status: 404,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    })
  } else {
    // Increment load count
    const incrementResult = await db.prepare('UPDATE saved_announcements SET load_count = load_count + 1 WHERE id = ?').bind(id).run()

    return new Response(
      JSON.stringify({
        error: false,
        data: {
          systemId: result.results[0].system_id,
          tabId: result.results[0].tab_id,
          state: JSON.parse(result.results[0].state as string),
        },
        savedAt: result.results[0].created_at,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      },
    )
  }
}
