/** Logique pure de l'écran d'ajout : deviner une catégorie, reconnaître un ISBN, regrouper des
 * résultats par série, fabriquer la ligne à insérer. Extrait de AddBook.svelte pour être
 * testable — tout ce qui touche au DOM, à la caméra ou à Supabase reste dans le composant. */
import { parseSeriesVolume } from './series.ts'
import type { BookLookupResult } from './bookLookup.ts'

export type SeriesGroup = { series: string; items: BookLookupResult[] }

// ponytail: éditeurs de manga francophones les plus courants — les tags "categories" de Google
// Books (souvent juste "Juvenile Fiction" ou absents) ne suffisent pas à distinguer un manga.
const MANGA_PUBLISHERS = [
  'kana', 'pika', 'kurokawa', 'ki-oon', 'tonkam', 'glénat manga', 'soleil manga',
  'panini manga', 'ankama', 'akata', 'doki-doki', 'meian', 'mangetsu', 'komikku', 'kazé manga',
]

/** Devine la catégorie à partir des tags Google Books, de l'éditeur, sinon d'un indice grossier
 * (série avec plusieurs tomes -> manga, le cas le plus fréquent ici). Simple pré-remplissage,
 * pas une vérité : l'utilisateur peut toujours corriger via les chips avant d'ajouter. */
export function guessCategory(items: BookLookupResult[]): string {
  const text = items
    .flatMap((i) => i.categories ?? [])
    .join(' ')
    .toLowerCase()
  const publishers = items.map((i) => (i.publisher ?? '').toLowerCase())
  if (text.includes('manga') || text.includes('shonen') || text.includes('shojo') || text.includes('seinen')) return 'manga'
  if (publishers.some((p) => MANGA_PUBLISHERS.some((m) => p.includes(m)))) return 'manga'
  if (text.includes('comic')) return 'comics'
  if (text.includes('bande dessin') || text.includes('graphic novel')) return 'bd'
  if (items.length > 1) return 'manga'
  return 'roman'
}

/** Un seul champ pour tout chercher : si la saisie ressemble à un ISBN (10 ou 13 chiffres,
 * tirets/espaces ignorés), on fait une recherche exacte par ISBN plutôt qu'une recherche texte. */
export function looksLikeIsbn(q: string): boolean {
  const cleaned = q.replace(/[-\s]/g, '')
  return /^(97[89])?\d{9}[\dXx]$/.test(cleaned)
}

export function groupBySeries(items: BookLookupResult[]): SeriesGroup[] {
  const map = new Map<string, BookLookupResult[]>()
  for (const r of items) {
    const key = parseSeriesVolume(r.title).series.toLowerCase()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return [...map.values()].map((group) => ({
    series: parseSeriesVolume(group[0].title).series,
    // Les titres sans numéro détecté (volume: null) doivent passer après les vrais tomes, pas
    // avant : sinon un résultat générique (parfois mal indexé par la source, couverture erronée)
    // se retrouve en position 0 et sert de vignette du groupe à la place du vrai tome 1.
    items: [...group].sort((a, b) => (parseSeriesVolume(a.title).volume ?? Infinity) - (parseSeriesVolume(b.title).volume ?? Infinity)),
  }))
}

export function resultKey(r: BookLookupResult): string {
  return r.isbn ?? r.title
}

export function foundVolume(g: { items: BookLookupResult[] }, n: number): BookLookupResult | null {
  return g.items.find((r) => parseSeriesVolume(r.title).volume === n) ?? null
}

/** La plage de tomes demandée, bornée à 300 pour qu'une saisie aberrante ("au tome 99999")
 * ne génère pas des dizaines de milliers de lignes. */
export function volumeRange(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, Math.min(to, from + 299) - from + 1) }, (_, i) => from + i)
}

/** La ligne `books` telle qu'elle part vers Supabase. */
export function bookRow(
  result: BookLookupResult,
  userId: string | undefined,
  category: string,
  status: string,
  series: string | null = null,
) {
  return {
    user_id: userId,
    isbn: result.isbn,
    title: result.title || 'Sans titre',
    authors: result.authors,
    publisher: result.publisher,
    cover_url: result.cover_url,
    pages: result.pages,
    category,
    status,
    series,
  }
}
