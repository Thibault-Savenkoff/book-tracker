// Comic Vine bloque les appels directs depuis un navigateur (pas de CORS) — ce relais tourne
// côté serveur, où ça n'a pas d'importance, et rajoute les en-têtes CORS pour l'app.
//
// Le relais porte COMICVINE_API_KEY : sans restriction il serait un proxy ouvert, et n'importe
// qui pourrait épuiser le quota. Deux garde-fous : une liste d'origines autorisées, et le JWT
// Supabase (seuls les utilisateurs connectés cherchent des livres).
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://macbook-air-de-anas.taildc31ca.ts.net',
  // Ajouter ici l'URL de production exacte au moment du déploiement Vercel.
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  // verify_jwt est activé côté config, mais on refuse explicitement ici aussi : la fonction ne
  // doit jamais répondre sans porteur, quelle que soit la façon dont elle est déployée.
  if (!req.headers.get('authorization')) return json({ error: 'missing authorization' }, 401)

  const query = new URL(req.url).searchParams.get('q')
  if (!query) return json({ error: 'missing q param' }, 400)

  const apiKey = Deno.env.get('COMICVINE_API_KEY')
  if (!apiKey) return json({ error: 'COMICVINE_API_KEY not configured' }, 500)

  const url = new URL('https://comicvine.gamespot.com/api/search/')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('resources', 'issue')
  url.searchParams.set('query', query)
  url.searchParams.set('field_list', 'name,issue_number,volume,image,cover_date')
  url.searchParams.set('limit', '16')

  const res = await fetch(url, { headers: { 'User-Agent': 'BiblioLog/1.0 (personal book tracker)' } })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } })
})
