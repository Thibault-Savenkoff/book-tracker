import { supabase } from './supabase.ts'

export type BookSource = 'Google Books' | 'OpenLibrary' | 'AniList' | 'Comic Vine'

export type BookLookupResult = {
  isbn: string | null
  title: string
  subtitle?: string | null
  authors: string[]
  publisher: string | null
  publishedDate?: string | null
  language?: string | null
  categories?: string[]
  description?: string | null
  cover_url: string | null
  pages: number | null
  source?: BookSource
}

export class LookupNetworkError extends Error {}

// Acronymes/alias courants pour mangas, comics et romans/fantasy — évite de taper le titre complet.
const ALIAS_MAP: Record<string, string> = {
  // Mangas
  mha: 'My Hero Academia',
  bnha: 'My Hero Academia',
  dbz: 'Dragon Ball Z',
  dbs: 'Dragon Ball Super',
  db: 'Dragon Ball',
  fma: 'Fullmetal Alchemist',
  fmab: 'Fullmetal Alchemist',
  snk: "L'Attaque des Titans",
  aot: 'Attack on Titan',
  jjk: 'Jujutsu Kaisen',
  csm: 'Chainsaw Man',
  hxh: 'Hunter x Hunter',
  opm: 'One Punch Man',
  kny: 'Demon Slayer Kimetsu no Yaiba',
  ds: 'Demon Slayer',
  dn: 'Death Note',
  tg: 'Tokyo Ghoul',
  sao: 'Sword Art Online',
  sl: 'Solo Leveling',
  orv: 'Omniscient Reader',
  tbate: 'The Beginning After The End',
  eva: 'Neon Genesis Evangelion',
  nge: 'Neon Genesis Evangelion',

  // Comics & BD
  twd: 'The Walking Dead',
  tdk: 'Batman The Dark Knight',
  cw: 'Civil War Marvel',

  // Romans & Fantasy
  lotr: 'Le Seigneur des Anneaux',
  sda: 'Le Seigneur des Anneaux',
  hp: 'Harry Potter',
  got: 'Game of Thrones',
  asoiaf: 'A Song of Ice and Fire',
  h2g2: 'Le Guide du voyageur galactique',
  wot: 'The Wheel of Time',
}

/** Reconnaît un acronyme exact (insensible à la casse/espaces) et renvoie le titre complet
 * correspondant, sinon null. Utilisé avant d'interroger les APIs pour élargir des saisies comme
 * "mha" ou "jjk" que Google Books/AniList ne reconnaîtraient pas telles quelles. */
export function expandAlias(query: string): string | null {
  const key = query.trim().toLowerCase()
  return ALIAS_MAP[key] ?? null
}

/** Le thumbnail par défaut de Google Books est en zoom=1 avec un effet de coin corné (edge=curl) —
 * minuscule et moche. On demande une résolution plus grande et on vire la décoration. */
function upgradeGoogleCover(url: string): string {
  return url.replace('zoom=1', 'zoom=3').replace('&edge=curl', '')
}

const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined

/** fetch() n'a pas de timeout par défaut — sans ça, une requête qui traîne bloque la recherche indéfiniment.
 * Lève une erreur sur échec réseau/timeout (distinct d'une réponse HTTP valide sans résultat). */
async function fetchJson(url: string, timeoutMs = 8000, init?: RequestInit): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) {
      console.error('bookLookup HTTP error:', url, res.status, await res.text().catch(() => ''))
      throw new LookupNetworkError(`HTTP ${res.status}`)
    }
    return await res.json()
  } catch (e) {
    if (e instanceof LookupNetworkError) throw e
    console.error('bookLookup fetch failed:', url, e)
    throw new LookupNetworkError('fetch failed')
  } finally {
    clearTimeout(timeout)
  }
}

async function lookupByIsbnOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
  const entry = data?.[`ISBN:${isbn}`]
  if (!entry) return null
  return {
    isbn,
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    authors: (entry.authors ?? []).map((a: { name: string }) => a.name),
    publisher: entry.publishers?.[0]?.name ?? null,
    publishedDate: entry.publish_date ?? null,
    categories: (entry.subjects ?? []).map((s: { name: string }) => s.name).slice(0, 6),
    cover_url: entry.cover?.large ?? entry.cover?.medium ?? null,
    pages: entry.number_of_pages ?? null,
  }
}

async function lookupByIsbnGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`)
  const item = data?.items?.[0]
  if (!item) return null
  const info = item.volumeInfo
  return {
    isbn,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    language: info.language ?? null,
    categories: info.categories ?? [],
    description: info.description ?? null,
    cover_url: info.imageLinks?.thumbnail ? upgradeGoogleCover(info.imageLinks.thumbnail.replace('http://', 'https://')) : null,
    pages: info.pageCount ?? null,
  }
}

async function searchOpenLibrary(query: string): Promise<BookLookupResult[]> {
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=40&fields=title,author_name,publisher,isbn,cover_i,number_of_pages_median,first_publish_year,language`,
  )
  return (data?.docs ?? []).map(
    (doc: {
      title: string
      author_name?: string[]
      publisher?: string[]
      isbn?: string[]
      cover_i?: number
      number_of_pages_median?: number
      first_publish_year?: number
      language?: string[]
    }) => ({
      isbn: doc.isbn?.[0] ?? null,
      title: doc.title,
      authors: doc.author_name ?? [],
      publisher: doc.publisher?.[0] ?? null,
      publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
      language: doc.language?.[0] ?? null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      pages: doc.number_of_pages_median ?? null,
    }),
  )
}

async function searchGoogleBooks(query: string): Promise<BookLookupResult[]> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=fr&maxResults=40${key}`,
  )
  return (data?.items ?? []).map(
    (item: {
      volumeInfo: {
        title: string
        subtitle?: string
        authors?: string[]
        publisher?: string
        publishedDate?: string
        language?: string
        categories?: string[]
        description?: string
        imageLinks?: { thumbnail?: string }
        industryIdentifiers?: { identifier: string }[]
        pageCount?: number
      }
    }) => ({
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier ?? null,
      title: item.volumeInfo.title,
      subtitle: item.volumeInfo.subtitle ?? null,
      authors: item.volumeInfo.authors ?? [],
      publisher: item.volumeInfo.publisher ?? null,
      publishedDate: item.volumeInfo.publishedDate ?? null,
      language: item.volumeInfo.language ?? null,
      categories: item.volumeInfo.categories ?? [],
      description: item.volumeInfo.description ?? null,
      cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
      pages: item.volumeInfo.pageCount ?? null,
    }),
  )
}

type GoogleImageLinks = { extraLarge?: string; large?: string; medium?: string; small?: string; thumbnail?: string }

/** Le champ `thumbnail` est presque toujours le seul renseigné par l'API recherche, mais quand
 * une édition a des variantes plus grandes (extraLarge/large/medium), on les préfère : c'est le
 * but même de ce picker, avoir une meilleure image que celle sauvée à l'ajout. */
function bestGoogleCovers(links: GoogleImageLinks | undefined): string[] {
  if (!links) return []
  const ordered = [links.extraLarge, links.large, links.medium, links.small, links.thumbnail].filter(
    (u): u is string => !!u,
  )
  return ordered.map((u) => upgradeGoogleCover(u.replace('http://', 'https://')))
}

async function searchGoogleBooksCoversRaw(query: string): Promise<string[]> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40${key}`)
  return (data?.items ?? []).flatMap((item: { volumeInfo?: { imageLinks?: GoogleImageLinks } }) =>
    bestGoogleCovers(item.volumeInfo?.imageLinks),
  )
}

async function searchGoogleBooksCoversTitled(query: string): Promise<{ title: string; covers: string[] }[]> {
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40${key}`)
  return (data?.items ?? []).map((item: { volumeInfo?: { title?: string; imageLinks?: GoogleImageLinks } }) => ({
    title: item.volumeInfo?.title ?? '',
    covers: bestGoogleCovers(item.volumeInfo?.imageLinks),
  }))
}

/** Une recherche par mots-clés (OpenLibrary/Google Books) remonte parfois des titres sans aucun
 * rapport (un magazine "Indianapolis Monthly #34" pour "My Hero Academia Tome 34") — on exige donc
 * que le titre candidat contienne les mots du VRAI titre (titleHint, fourni par l'appelant) avant de
 * garder sa couverture. Ne pas dériver ce filtre de la requête de recherche elle-même : elle contient
 * souvent des mots annexes (auteurs, "édition collector"...) qui n'apparaissent jamais dans un titre
 * de catalogue et rendraient le filtre trop strict (plus aucun résultat, même les bons). */
function isRelevantTitle(title: string, titleHint: string): boolean {
  const bare = titleHint.replace(/\s*(tome|vol\.?|volume)\s*\d+/gi, '').trim()
  const words = normalizeTitle(bare)
    .split(' ')
    .filter((w) => w.length > 2)
  if (!words.length) return true
  const t = normalizeTitle(title)
  return words.every((w) => t.includes(w))
}

/** Toutes les couvertures trouvées par les deux sources (pas juste la meilleure) — pour laisser
 * l'utilisateur choisir, comme le sélecteur de poster de Letterboxd. On interroge aussi le titre
 * sans le numéro de tome (sans restriction de langue) : un tome isolé d'une série peu connue ne
 * remonte souvent qu'un seul résultat sinon. */
async function coversFor(query: string, titleHint: string): Promise<string[]> {
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(query), searchGoogleBooksCoversTitled(query)])
  return [
    ...(ol.status === 'fulfilled' ? ol.value.filter((r) => isRelevantTitle(r.title, titleHint)).map((r) => r.cover_url) : []),
    ...(gb.status === 'fulfilled' ? gb.value.filter((r) => isRelevantTitle(r.title, titleHint)).flatMap((r) => r.covers) : []),
  ].filter((u): u is string => !!u)
}

/** L'ISBN identifie une édition précise sans ambiguïté — pas de risque de remonter un autre
 * tome ou un artbook. On l'utilise en priorité quand il est connu. */
async function coversForIsbn(isbn: string): Promise<string[]> {
  const [ol, gb] = await Promise.allSettled([lookupByIsbnOpenLibrary(isbn), searchGoogleBooksCoversRaw(`isbn:${isbn}`)])
  return [
    ...(ol.status === 'fulfilled' && ol.value?.cover_url ? [ol.value.cover_url] : []),
    ...(gb.status === 'fulfilled' ? gb.value : []),
  ]
}

/** Recherche stricte d'abord (titre + numéro de tome) : pour une série connue (Radiant, One
 * Piece...), l'enlever ramène toutes les couvertures de tous les tomes plus des faux positifs
 * (magazines, artbooks) — inutilisable. On n'élargit sur le titre nu que si la recherche stricte
 * est trop pauvre (< 4 résultats), typique d'un tome isolé peu indexé. */
export async function searchCoverCandidates(query: string, isbn?: string | null, titleHint?: string): Promise<string[]> {
  const byIsbn = isbn ? await coversForIsbn(isbn) : []
  if (byIsbn.length > 0) return [...new Set(byIsbn)].slice(0, 16)

  const hint = titleHint ?? query
  const strict = await coversFor(query, hint)
  const bareQuery = query.replace(/[-–:]?\s*(tome|vol\.?|volume)\s*\d+/i, '').trim()
  let all = strict
  if (new Set(strict).size < 4 && bareQuery && bareQuery !== query) {
    all = [...strict, ...(await coversFor(bareQuery, hint))]
  }
  return [...new Set(all)].slice(0, 16)
}

const ANILIST_QUERY = `
  query ($search: String) {
    Page(perPage: 12) {
      media(search: $search, type: MANGA) {
        title { romaji english }
        coverImage { extraLarge large medium }
        staff(perPage: 3) { edges { role node { name { full } } } }
        volumes
      }
    }
  }
`

type AniListMedia = {
  title: { romaji?: string; english?: string }
  coverImage?: { extraLarge?: string; large?: string; medium?: string }
  staff?: { edges: { role: string; node: { name: { full: string } } }[] }
  volumes?: number | null
}

const normalizeTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Une recherche floue ("My Hero Academia") remonte souvent des spin-offs/doujinshi avant la
 * série principale (ex: AniList renvoie "School Briefs" en position 0, MangaDex un doujinshi) —
 * on préfère donc le résultat dont le titre correspond exactement, sinon le plus proche. */
function pickBestTitleMatch<T>(seriesTitle: string, entries: T[], getTitles: (e: T) => (string | undefined)[]): T | undefined {
  const target = normalizeTitle(seriesTitle)
  if (!entries.length) return undefined
  const exact = entries.find((e) => getTitles(e).some((t) => t && normalizeTitle(t) === target))
  if (exact) return exact
  const contains = entries.find((e) => getTitles(e).some((t) => t && normalizeTitle(t).includes(target)))
  return contains ?? entries[0]
}

/** AniList connaît le nombre officiel de tomes d'une série (ex: 42 pour My Hero Academia) —
 * sert à pré-remplir "Au tome" plutôt que de deviner depuis les quelques résultats Google Books. */
export async function getSeriesVolumeCount(seriesTitle: string): Promise<number | null> {
  try {
    const data = await fetchJson('https://graphql.anilist.co', 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: seriesTitle } }),
    })
    const media: AniListMedia[] = data?.data?.Page?.media ?? []
    const best = pickBestTitleMatch(seriesTitle, media, (m) => [m.title?.romaji, m.title?.english])
    return best?.volumes ?? null
  } catch {
    return null
  }
}

// Un tome a souvent plusieurs jaquettes sur MangaDex (une par langue d'édition : fr, ja...) — ce
// sont de vraies alternatives (contrairement au bruit d'une recherche par mots-clés), on les garde
// toutes plutôt que d'en jeter une, la VF passant en premier (choix par défaut le plus pertinent ici).
export type MangaDexCoverMap = Record<number, string[]>

/** MangaDex expose gratuitement, sans clé ni CORS, la couverture officielle de chaque tome d'une
 * série — contrairement à Google Books qui ne renvoie qu'un échantillon partiel et désordonné
 * (vérifié : 20 résultats sur 42 tomes réels, non consécutifs). Échoue en silence (renvoie {}) :
 * c'est un complément, pas une dépendance bloquante pour l'écran de série. */
export async function fetchMangaDexCovers(seriesTitle: string): Promise<MangaDexCoverMap> {
  try {
    const search = await fetchJson(`https://api.mangadex.org/manga?title=${encodeURIComponent(seriesTitle)}&limit=10`)
    const candidates: { id: string; attributes: { title: Record<string, string>; altTitles?: Record<string, string>[] } }[] = search?.data ?? []
    const best = pickBestTitleMatch(seriesTitle, candidates, (c) => [
      ...Object.values(c.attributes?.title ?? {}),
      ...(c.attributes?.altTitles ?? []).flatMap((t) => Object.values(t)),
    ])
    const mangaId = best?.id
    if (!mangaId) return {}

    // Une longue série (One Piece...) peut dépasser les 100 couvertures max par page (plusieurs
    // langues x nombreux tomes) — paginer, sinon les derniers tomes perdent silencieusement leur VF.
    const covers: { attributes: { volume?: string; fileName?: string; locale?: string } }[] = []
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await fetchJson(`https://api.mangadex.org/cover?manga[]=${mangaId}&limit=100&offset=${offset}`)
      covers.push(...(page?.data ?? []))
      if (!page?.total || covers.length >= page.total) break
    }

    const localeRank = (locale: string | undefined) => (locale === 'fr' ? 0 : locale === 'ja' ? 1 : 2)
    const byVolume = new Map<number, { url: string; rank: number }[]>()
    for (const c of covers) {
      const vol = Number(c?.attributes?.volume)
      const fileName = c?.attributes?.fileName
      if (!fileName || !Number.isFinite(vol)) continue
      const url = `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`
      const rank = localeRank(c?.attributes?.locale)
      byVolume.set(vol, [...(byVolume.get(vol) ?? []), { url, rank }])
    }
    const map: MangaDexCoverMap = {}
    for (const [vol, entries] of byVolume) {
      map[vol] = entries.sort((a, b) => a.rank - b.rank).map((e) => e.url)
    }
    return map
  } catch {
    return {}
  }
}

/** AniList : pas de clé, CORS ouvert, et surtout un vrai signal "manga" garanti (contrairement
 * aux tags Google Books, souvent vides ou juste "Juvenile Fiction"). Pas d'ISBN par édition
 * (c'est une base séries/tomes, pas éditions physiques) donc uniquement pour la recherche texte. */
async function searchAniList(query: string): Promise<BookLookupResult[]> {
  const data = await fetchJson('https://graphql.anilist.co', 8000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: query } }),
  })
  const media: AniListMedia[] = data?.data?.Page?.media ?? []
  return media
    .map((m) => {
      const cover = m.coverImage?.extraLarge ?? m.coverImage?.large ?? m.coverImage?.medium ?? null
      const title = m.title.english ?? m.title.romaji
      if (!cover || !title) return null
      const authors = (m.staff?.edges ?? [])
        .filter((e) => /story|art/i.test(e.role))
        .map((e) => e.node.name.full)
      const result: BookLookupResult = {
        isbn: null,
        title,
        authors: [...new Set(authors)],
        publisher: null,
        cover_url: cover,
        categories: ['Manga'],
        pages: null,
        source: 'AniList',
      }
      return result
    })
    .filter((r): r is BookLookupResult => r !== null)
}

type ComicVineIssue = {
  name: string | null
  issue_number: string | null
  cover_date: string | null
  volume?: { name?: string }
  image?: { super_url?: string; screen_large_url?: string; medium_url?: string }
}

/** Comic Vine bloque les appels directs depuis un navigateur (pas de CORS) — on passe par un
 * relais côté serveur (Supabase Edge Function) qui porte la clé API. Le relais exige un JWT
 * (verify_jwt), donc on joint le token de la session courante. */
async function searchComicVine(query: string): Promise<BookLookupResult[]> {
  const base = import.meta.env.VITE_SUPABASE_URL as string
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return []
  const data = await fetchJson(`${base}/functions/v1/comicvine-search?q=${encodeURIComponent(query)}`, 8000, {
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
  })
  const issues: ComicVineIssue[] = data?.results ?? []
  return issues
    .map((issue) => {
      const cover = issue.image?.super_url ?? issue.image?.screen_large_url ?? issue.image?.medium_url ?? null
      const series = issue.volume?.name
      if (!cover || !series) return null
      const title = issue.name ? `${series} - ${issue.name}` : `${series} #${issue.issue_number ?? '?'}`
      const result: BookLookupResult = {
        isbn: null,
        title,
        authors: [],
        publisher: null,
        publishedDate: issue.cover_date ?? null,
        cover_url: cover,
        categories: ['Comics'],
        pages: null,
        source: 'Comic Vine',
      }
      return result
    })
    .filter((r): r is BookLookupResult => r !== null)
}

/** Les deux sources sont interrogées en parallèle (pas l'une après l'autre) : une source down
 * ne rajoute pas son propre timeout à l'attente. Open Library est préféré si les deux répondent.
 * Ne lève que si les deux échouent réseau (une des deux qui répond "pas trouvé" suffit). */
export async function lookupByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const [ol, gb] = await Promise.allSettled([lookupByIsbnOpenLibrary(isbn), lookupByIsbnGoogleBooks(isbn)])
  if (ol.status === 'fulfilled' && ol.value) return ol.value
  if (gb.status === 'fulfilled' && gb.value) return gb.value
  if (ol.status === 'rejected' && gb.status === 'rejected') throw ol.reason
  return null
}

export type SourceLatency = { ms: number; ok: boolean }
export type SearchLatencies = Record<'google' | 'openlibrary' | 'anilist' | 'comicvine', SourceLatency>

/** Chronomètre un appel source sans changer son résultat — sert uniquement à afficher un vrai
 * indicateur de latence par API (pas une valeur inventée) dans l'écran de recherche. */
async function timed<T>(p: Promise<T>): Promise<{ settled: PromiseSettledResult<T>; latency: SourceLatency }> {
  const start = performance.now()
  const settled = await p.then(
    (value): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value }),
    (reason): PromiseRejectedResult => ({ status: 'rejected', reason }),
  )
  return { settled, latency: { ms: Math.round(performance.now() - start), ok: settled.status === 'fulfilled' } }
}

/** Google Books est préféré ici (contrairement à lookupByIsbn) : son classement par pertinence
 * est bien meilleur qu'OpenLibrary sur une recherche plein-texte (nom d'auteur, titre partiel...). */
export async function searchByTitle(query: string): Promise<{ results: BookLookupResult[]; latencies: SearchLatencies }> {
  const [olT, gbT, alT, cvT] = await Promise.all([
    timed(searchOpenLibrary(query)),
    timed(searchGoogleBooks(query)),
    timed(searchAniList(query)),
    timed(searchComicVine(query)),
  ])
  const ol = olT.settled
  const gb = gbT.settled
  const al = alT.settled
  const cv = cvT.settled
  const latencies: SearchLatencies = { openlibrary: olT.latency, google: gbT.latency, anilist: alT.latency, comicvine: cvT.latency }

  const gbTagged = gb.status === 'fulfilled' ? gb.value.map((r) => ({ ...r, source: 'Google Books' as const })) : []
  const olTagged = ol.status === 'fulfilled' ? ol.value.map((r) => ({ ...r, source: 'OpenLibrary' as const })) : []
  const base = gbTagged.length > 0 ? gbTagged : olTagged
  if (base.length === 0 && ol.status === 'rejected' && gb.status === 'rejected') throw gb.reason
  // AniList et Comic Vine viennent toujours en complément (jamais en remplacement) : signal de
  // catégorie fiable et couvertures nettes, mais aucune notion d'édition/ISBN comme Google/OL.
  const results = [...base, ...(al.status === 'fulfilled' ? al.value : []), ...(cv.status === 'fulfilled' ? cv.value : [])]
  return { results, latencies }
}
