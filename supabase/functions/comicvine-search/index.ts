// Comic Vine bloque les appels directs depuis un navigateur (pas de CORS) — ce relais tourne
// côté serveur, où ça n'a pas d'importance, et rajoute les en-têtes CORS pour l'app.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const query = new URL(req.url).searchParams.get('q')
  if (!query) return new Response(JSON.stringify({ error: 'missing q param' }), { status: 400, headers: CORS_HEADERS })

  const apiKey = Deno.env.get('COMICVINE_API_KEY')
  if (!apiKey) return new Response(JSON.stringify({ error: 'COMICVINE_API_KEY not configured' }), { status: 500, headers: CORS_HEADERS })

  const url = new URL('https://comicvine.gamespot.com/api/search/')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('resources', 'issue')
  url.searchParams.set('query', query)
  url.searchParams.set('field_list', 'name,issue_number,volume,image,cover_date')
  url.searchParams.set('limit', '16')

  const res = await fetch(url, { headers: { 'User-Agent': 'BiblioLog/1.0 (personal book tracker)' } })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
})
