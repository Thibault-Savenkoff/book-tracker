<script lang="ts">
  import { onDestroy } from 'svelte'
  import { supabase } from '../supabase'
  import { currentView } from '../nav'
  import {
    searchByTitle,
    lookupByIsbn,
    expandAlias,
    fetchMangaDexCovers,
    getSeriesVolumeCount,
    searchCoverCandidates,
    LookupNetworkError,
    type BookLookupResult,
    type SearchLatencies,
  } from '../bookLookup'
  import { CATEGORY_LABEL, CATEGORY_BADGE_CLASS, STATUS_LABEL } from '../bookStyle'
  import { parseSeriesVolume } from '../series'

  type Category = keyof typeof CATEGORY_LABEL
  type Status = keyof typeof STATUS_LABEL
  // ponytail: "Abandonné" n'a pas de sens au moment d'ajouter un livre, seulement depuis la fiche.
  const ADD_STATUSES: Status[] = ['wishlist', 'reading', 'read']

  let { initialQuery }: { initialQuery?: string } = $props()
  const seedQuery = initialQuery

  let query = $state(seedQuery ?? '')
  let searchInputEl = $state<HTMLInputElement | null>(null)
  let results = $state<BookLookupResult[]>([])
  let latencies = $state<SearchLatencies | null>(null)
  let expandedAliasTo = $state<string | null>(null)
  let searching = $state(false)
  let searchError = $state<string | null>(null)
  let isbnNotFound = $state(false)
  let ownedMatch = $state<{ id: string; title: string; status: Status } | null>(null)
  let previewItem = $state<BookLookupResult | null>(null)
  let previewCategory = $state<Category>('roman')
  let previewStatus = $state<Status>('wishlist')
  let seriesView = $state<{ series: string; items: BookLookupResult[] } | null>(null)
  let seriesCategory = $state<Category>('manga')
  let seriesStatus = $state<Status>('wishlist')
  let seriesFrom = $state(1)
  let seriesTo = $state(1)
  let seriesCovers = $state<Record<number, string>>({})
  let seriesCoversLoading = $state(false)
  let isSearchingVolume = $state<Record<number, boolean>>({})
  let volumePicker = $state<number | null>(null)
  let volumePickerCandidates = $state<string[]>([])
  let volumePickerLoading = $state(false)
  let scannerOpen = $state(false)
  let scanError = $state<string | null>(null)
  let adding = $state(false)

  // ponytail: éditeurs de manga francophones les plus courants — les tags "categories" de Google
  // Books (souvent juste "Juvenile Fiction" ou absents) ne suffisent pas à distinguer un manga.
  const MANGA_PUBLISHERS = [
    'kana', 'pika', 'kurokawa', 'ki-oon', 'tonkam', 'glénat manga', 'soleil manga',
    'panini manga', 'ankama', 'akata', 'doki-doki', 'meian', 'mangetsu', 'komikku', 'kazé manga',
  ]

  /** Devine la catégorie à partir des tags Google Books, de l'éditeur, sinon d'un indice grossier
   * (série avec plusieurs tomes -> manga, le cas le plus fréquent ici). Simple pré-remplissage,
   * pas une vérité : l'utilisateur peut toujours corriger via les chips avant d'ajouter. */
  function guessCategory(items: BookLookupResult[]): Category {
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
  function looksLikeIsbn(q: string): boolean {
    const cleaned = q.replace(/[-\s]/g, '')
    return /^(97[89])?\d{9}[\dXx]$/.test(cleaned)
  }

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    results = []
    latencies = null
    expandedAliasTo = null
    seriesView = null
    if (looksLikeIsbn(q)) {
      await runIsbnLookup(q)
      return
    }
    const alias = expandAlias(q)
    const effectiveQuery = alias ?? q
    if (alias) expandedAliasTo = alias
    searching = true
    searchError = null
    isbnNotFound = false
    ownedMatch = null
    try {
      const outcome = await searchByTitle(effectiveQuery)
      results = outcome.results
      latencies = outcome.latencies
    } catch (e) {
      searchError = e instanceof LookupNetworkError ? "Recherche indisponible — vérifie ta connexion." : 'Erreur inattendue.'
    } finally {
      searching = false
    }
  }

  /** En magasin, ce qu'on veut savoir en scannant un code-barre c'est d'abord "je l'ai déjà ?" —
   * on vérifie donc dans sa propre collection avant d'aller chercher les métadonnées externes. */
  async function runIsbnLookup(isbn: string) {
    searching = true
    searchError = null
    isbnNotFound = false
    ownedMatch = null
    try {
      const { data: owned } = await supabase.from('books').select('id,title,status').eq('isbn', isbn).maybeSingle()
      if (owned) {
        ownedMatch = owned
        return
      }
      const result = await lookupByIsbn(isbn)
      if (result) openPreview(result)
      else isbnNotFound = true
    } catch (e) {
      searchError = e instanceof LookupNetworkError ? "Recherche indisponible — vérifie ta connexion." : 'Erreur inattendue.'
    } finally {
      searching = false
    }
  }

  function insertBook(result: BookLookupResult, userId: string | undefined, category: Category, status: Status, series: string | null = null) {
    return supabase
      .from('books')
      .insert({
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
      })
      .select()
      .single()
  }

  async function addBook(result: BookLookupResult, category: Category = 'roman', status: Status = 'wishlist', series: string | null = null) {
    if (adding) return
    adding = true
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await insertBook(result, userData.user?.id, category, status, series)
    adding = false
    stopScanner()
    if (!error && data) currentView.set({ name: 'book', id: data.id })
  }

  function openPreview(r: BookLookupResult) {
    previewItem = r
    previewCategory = guessCategory([r])
    previewStatus = 'wishlist'
  }

  function addManual() {
    addBook({ isbn: null, title: '', authors: [], publisher: null, cover_url: null, pages: null })
  }

  function groupBySeries(items: BookLookupResult[]): { series: string; items: BookLookupResult[] }[] {
    const map = new Map<string, BookLookupResult[]>()
    for (const r of items) {
      const key = parseSeriesVolume(r.title).series.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return [...map.values()].map((group) => ({
      series: parseSeriesVolume(group[0].title).series,
      items: [...group].sort((a, b) => (parseSeriesVolume(a.title).volume ?? 0) - (parseSeriesVolume(b.title).volume ?? 0)),
    }))
  }

  const groups = $derived(groupBySeries(results))

  function resultKey(r: BookLookupResult) {
    return r.isbn ?? r.title
  }

  /** Google Books ne renvoie qu'un échantillon partiel et dans le désordre pour une recherche par
   * série (vérifié : 20 résultats sur 42 tomes réels, non consécutifs) — impossible de s'y fier pour
   * énumérer une série complète. On demande donc une plage de tomes à l'utilisateur et on génère les
   * entrées ; les tomes réellement trouvés dans les résultats récupèrent leur vraie couverture/ISBN. */
  async function openSeries(g: { series: string; items: BookLookupResult[] }) {
    seriesView = g
    seriesCategory = guessCategory(g.items)
    seriesStatus = 'wishlist'
    seriesCovers = {}
    const volumes = g.items.map((r) => parseSeriesVolume(r.title).volume).filter((v): v is number => v !== null)
    seriesFrom = 1
    seriesTo = volumes.length ? Math.max(...volumes) : g.items.length

    // Nombre officiel de tomes (AniList) : pré-remplit "Au tome" mieux que le sous-échantillon Google Books.
    getSeriesVolumeCount(g.series).then((count) => {
      if (count && seriesView?.series === g.series && seriesTo < count) seriesTo = count
    })
    // Couvertures complètes par tome (mangas uniquement) : un seul appel MangaDex plutôt que de
    // multiplier les recherches Google Books, qui ne renvoient qu'un échantillon incomplet.
    if (seriesCategory === 'manga') {
      seriesCoversLoading = true
      const covers = await fetchMangaDexCovers(g.series)
      seriesCoversLoading = false
      if (seriesView?.series === g.series) seriesCovers = covers
    }
  }

  function foundVolume(g: { items: BookLookupResult[] }, n: number): BookLookupResult | null {
    return g.items.find((r) => parseSeriesVolume(r.title).volume === n) ?? null
  }

  // $derived (pas un simple calcul dans le template) : se recalcule dès que fromVolume/toVolume
  // changent, ce qui redéclenche l'effet de chargement des couvertures ci-dessous.
  const seriesVolumeList = $derived(
    seriesView ? Array.from({ length: Math.max(0, Math.min(seriesTo, seriesFrom + 299) - seriesFrom + 1) }, (_, i) => seriesFrom + i) : [],
  )

  /** Une recherche globale sur la série ne remonte qu'un échantillon partiel et désordonné
   * (vérifié : 20 résultats sur 42 tomes réels) — on cible donc explicitement "Tome N" pour
   * chaque tome resté sans couverture (ni résultat de recherche, ni MangaDex). */
  async function loadMissingCover(seriesTitle: string, volNumber: number) {
    if (seriesCovers[volNumber] || isSearchingVolume[volNumber]) return
    isSearchingVolume[volNumber] = true
    try {
      const q = encodeURIComponent(`intitle:"${seriesTitle}" "tome ${volNumber}"`)
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`)
      const data = await res.json()
      const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (img) seriesCovers[volNumber] = img.replace('http://', 'https://')
    } catch (e) {
      console.error(`Erreur cover T${volNumber}`, e)
    } finally {
      isSearchingVolume[volNumber] = false
    }
  }

  /** Par lots de 5 en parallèle plutôt que tout d'un coup : évite de saturer l'API Google Books
   * sur une grande plage (ex. 1 à 42) et de se faire rate-limiter. */
  async function loadMissingCoversBatched(g: { series: string; items: BookLookupResult[] }, volumes: number[]) {
    const missing = volumes.filter((n) => !foundVolume(g, n)?.cover_url && !seriesCovers[n] && !isSearchingVolume[n])
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(missing.slice(i, i + 5).map((n) => loadMissingCover(g.series, n)))
    }
  }

  $effect(() => {
    if (seriesView && seriesVolumeList.length) loadMissingCoversBatched(seriesView, seriesVolumeList)
  })

  /** Tome resté sans couverture (ni résultat trouvé, ni MangaDex) : recherche ciblée sur ce tome
   * précis, réutilise le même moteur que le sélecteur de couverture de la fiche livre. */
  async function pickVolumeCover(n: number) {
    if (!seriesView) return
    volumePicker = n
    volumePickerLoading = true
    volumePickerCandidates = await searchCoverCandidates(`${seriesView.series} Tome ${n}`)
    volumePickerLoading = false
  }

  function applyVolumeCover(url: string) {
    if (volumePicker === null) return
    seriesCovers = { ...seriesCovers, [volumePicker]: url }
    volumePicker = null
  }

  async function addSeriesRange() {
    if (adding || !seriesView) return
    const from = Math.max(1, Math.min(seriesFrom, seriesTo))
    const to = Math.min(from + 199, Math.max(seriesFrom, seriesTo))
    adding = true
    const { data: userData } = await supabase.auth.getUser()
    for (let n = from; n <= to; n++) {
      const match = foundVolume(seriesView, n)
      const base: BookLookupResult = match ?? {
        isbn: null,
        title: `${seriesView.series} Tome ${n}`,
        authors: seriesView.items[0].authors,
        publisher: seriesView.items[0].publisher,
        cover_url: seriesCovers[n] ?? null,
        pages: null,
      }
      await insertBook(base, userData.user?.id, seriesCategory, seriesStatus, seriesView.series)
    }
    adding = false
    seriesView = null
    currentView.set({ name: 'collection' })
  }

  let html5QrCode: import('html5-qrcode').Html5Qrcode | null = null
  let scanState = $state<'idle' | 'scanning'>('idle')
  let scanDecoded = false

  async function openScanner() {
    scanError = null
    isbnNotFound = false
    ownedMatch = null
    scannerOpen = true
    scanState = 'scanning'
    scanDecoded = false
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('scanner')
    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decodedText) => {
          if (scanDecoded) return
          scanDecoded = true
          html5QrCode?.pause(true)
          runIsbnLookup(decodedText)
        },
        () => {},
      )
    } catch {
      scanError = "Impossible d'accéder à la caméra (HTTPS requis, vérifie les permissions)."
      scanState = 'idle'
    }
  }

  function scanAgain() {
    isbnNotFound = false
    ownedMatch = null
    scanDecoded = false
    html5QrCode?.resume()
  }

  function stopScanner() {
    if (html5QrCode) {
      html5QrCode.stop().catch(() => {})
      html5QrCode = null
    }
    scannerOpen = false
    scanState = 'idle'
  }

  onDestroy(stopScanner)

  if (seedQuery) runSearch()

  function chipClass(active: boolean) {
    return active
      ? 'px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-indigo-600 text-white'
      : 'px-3 py-1.5 rounded-lg text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5'
  }

  const SOURCE_PILLS: { key: keyof SearchLatencies; label: string }[] = [
    { key: 'google', label: 'Google Books' },
    { key: 'anilist', label: 'AniList API' },
    { key: 'openlibrary', label: 'OpenLibrary' },
    { key: 'comicvine', label: 'Comic Vine' },
  ]

  $effect(() => {
    if (!scannerOpen && !seriesView) searchInputEl?.focus()
  })

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (volumePicker !== null) volumePicker = null
    else if (previewItem) previewItem = null
    else if (seriesView) seriesView = null
    else if (scannerOpen) stopScanner()
    else currentView.set({ name: 'collection' })
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet coverFallback(title: string)}
  <div class="w-full h-full bg-app-card dark:bg-app-card border border-light-border dark:border-app-border flex flex-col items-center justify-center gap-1.5 p-2">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-slate-500 flex-shrink-0"
      ><path
        d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
    <span class="font-serif text-[10px] font-semibold text-slate-200 text-center px-1 line-clamp-2">{title}</span>
  </div>
{/snippet}

<div class="p-4 md:p-8 flex justify-center">
  <div
    class="w-full md:max-w-2xl bg-light-surface dark:bg-app-surface md:border md:border-light-border md:dark:border-app-border rounded-2xl md:shadow-2xl p-0 md:p-8 space-y-6"
  >
    <div class="flex items-center gap-3">
      <button
        class="w-9 h-9 rounded-lg bg-light-card dark:bg-app-card border border-light-border dark:border-app-border flex items-center justify-center flex-shrink-0"
        onclick={() => currentView.set({ name: 'collection' })}
        aria-label="Retour"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <div>
        <span class="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Supabase Edge Proxy Dispatcher</span>
        <h1 class="font-serif text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Recherche fédérée</h1>
      </div>
    </div>

    {#if scannerOpen}
      <div class="relative w-full aspect-square rounded-3xl bg-black overflow-hidden border border-light-border dark:border-app-border">
        <div id="scanner" class="w-full h-full"></div>
        <div class="scan-corner scan-corner-tl"></div>
        <div class="scan-corner scan-corner-tr"></div>
        <div class="scan-corner scan-corner-bl"></div>
        <div class="scan-corner scan-corner-br"></div>
        {#if scanState === 'scanning'}<div class="scanline"></div>{/if}
      </div>
      {#if scanError}<p class="text-sm text-red-500">{scanError}</p>{/if}
      {#if searching}<p class="text-sm text-slate-400">Recherche du livre…</p>{/if}
      {#if ownedMatch}
        <div class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-indigo-500/40">
          <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">✓</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-slate-900 dark:text-white">Tu l'as déjà</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">{ownedMatch.title} — {STATUS_LABEL[ownedMatch.status]}</div>
          </div>
        </div>
        <button class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold" onclick={() => currentView.set({ name: 'book', id: ownedMatch!.id })}
          >Voir la fiche</button
        >
        <button class="w-full py-3 rounded-xl border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 text-sm font-medium" onclick={scanAgain}
          >Scanner un autre livre</button
        >
      {:else if isbnNotFound}
        <p class="text-sm text-slate-400">Aucun livre trouvé pour ce code-barre.</p>
        <button class="w-full py-3 rounded-xl border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 text-sm font-medium" onclick={scanAgain}
          >Scanner un autre livre</button
        >
      {/if}
      <button class="w-full py-3 rounded-xl border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 text-sm font-medium" onclick={stopScanner}
        >Fermer le scanner</button
      >
    {:else if seriesView}
      <button class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400" onclick={() => (seriesView = null)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Retour aux résultats
      </button>
      <div>
        <div class="font-serif text-xl font-bold text-slate-900 dark:text-white">{seriesView.series}</div>
        <div class="text-xs text-slate-400 mt-0.5">{seriesView.items[0].authors.join(', ')}</div>
      </div>
      <p class="text-xs text-slate-400 leading-relaxed">
        Google ne connaît pas la liste complète des tomes d'une série — indique la plage que tu possèdes, les couvertures des tomes trouvés seront utilisées automatiquement.
      </p>
      <div class="flex gap-3">
        <label class="flex-1 flex flex-col gap-1 text-[11px] text-slate-400">
          Du tome
          <input type="number" min="1" bind:value={seriesFrom} class="px-3 py-2 rounded-lg border border-light-border dark:border-app-border bg-light-card dark:bg-app-card text-sm text-slate-900 dark:text-white" />
        </label>
        <label class="flex-1 flex flex-col gap-1 text-[11px] text-slate-400">
          Au tome
          <input type="number" min="1" bind:value={seriesTo} class="px-3 py-2 rounded-lg border border-light-border dark:border-app-border bg-light-card dark:bg-app-card text-sm text-slate-900 dark:text-white" />
        </label>
      </div>
      <div class="flex flex-wrap gap-2 justify-center">
        {#each Object.keys(CATEGORY_LABEL) as c (c)}
          <button type="button" class={chipClass(seriesCategory === c)} onclick={() => (seriesCategory = c as Category)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
      <div class="flex flex-wrap gap-2 justify-center">
        {#each ADD_STATUSES as s (s)}
          <button type="button" class={chipClass(seriesStatus === s)} onclick={() => (seriesStatus = s as Status)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
      {#if seriesCoversLoading}<p class="text-xs text-slate-400">Récupération des couvertures MangaDex…</p>{/if}
      <div class="grid grid-cols-4 sm:grid-cols-6 gap-3.5">
        {#each seriesVolumeList as n (n)}
          {@const match = foundVolume(seriesView, n)}
          {@const cover = match?.cover_url ?? seriesCovers[n]}
          {@const searching = isSearchingVolume[n]}
          <div class="flex flex-col items-center gap-1.5">
            <div
              class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-light-card dark:bg-app-card border border-light-border dark:border-app-border"
              class:cursor-pointer={!cover}
              class:animate-pulse={searching && !cover}
              role="button"
              tabindex="0"
              onclick={() => !cover && pickVolumeCover(n)}
              onkeydown={(e) => e.key === 'Enter' && !cover && pickVolumeCover(n)}
            >
              {#if cover}
                <img src={cover} alt="Tome {n}" class="w-full h-full object-cover" />
              {:else if searching}
                <div class="w-full h-full flex items-center justify-center">
                  <svg class="animate-spin text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
                    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                  </svg>
                </div>
              {:else}
                {@render coverFallback(`T${n}`)}
              {/if}
            </div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">T{n}</div>
          </div>
        {/each}
      </div>
      <button
        class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
        onclick={addSeriesRange}
        disabled={adding || seriesTo < seriesFrom}
      >
        Ajouter les tomes {Math.min(seriesFrom, seriesTo)} à {Math.max(seriesFrom, seriesTo)}
      </button>
    {:else}
      <div class="relative">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-indigo-600 dark:text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2"
          ><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
        <input
          bind:this={searchInputEl}
          placeholder="Titre, auteur, ISBN…"
          bind:value={query}
          onkeydown={(e) => e.key === 'Enter' && runSearch()}
          class="w-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border focus:border-indigo-500 rounded-xl py-3.5 pl-12 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition"
        />
        <button
          class="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border flex items-center justify-center text-slate-500 dark:text-slate-400"
          onclick={openScanner}
          aria-label="Scanner un code-barre"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            ><path
              d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M7 12h10"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        </button>
      </div>

      {#if expandedAliasTo}
        <p class="text-[11px] text-slate-400 italic">Recherche étendue pour : « {expandedAliasTo} »</p>
      {/if}

      {#if latencies}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] font-mono">
          {#each SOURCE_PILLS as p (p.key)}
            {@const lat = latencies[p.key]}
            {@const isProxy = p.key === 'comicvine'}
            <div
              class={`p-2.5 rounded-lg border flex items-center justify-between ${
                isProxy ? 'bg-indigo-50 dark:bg-app-card border-indigo-200 dark:border-indigo-500/30' : 'bg-light-card dark:bg-app-card border-light-border dark:border-app-border'
              }`}
            >
              <span class={`flex items-center gap-1.5 ${isProxy ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                <span class={`w-1.5 h-1.5 rounded-full ${lat.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                {p.label}
              </span>
              {#if isProxy}
                <span class="text-indigo-600 dark:text-indigo-400 font-semibold">Proxy ✓</span>
              {:else}
                <span class={lat.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{lat.ms}ms</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if searching}<p class="text-sm text-slate-400">Recherche…</p>{/if}
      {#if searchError}<p class="text-sm text-red-500">{searchError}</p>{/if}
      {#if !searching && !searchError && query.trim() && results.length === 0 && !isbnNotFound && !ownedMatch}<p class="text-sm text-slate-400">Aucun résultat.</p>{/if}
      {#if isbnNotFound}<p class="text-sm text-slate-400">Aucun livre trouvé pour cet ISBN.</p>{/if}
      {#if ownedMatch}
        <div class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-indigo-500/40">
          <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">✓</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-slate-900 dark:text-white">Tu l'as déjà</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">{ownedMatch.title} — {STATUS_LABEL[ownedMatch.status]}</div>
          </div>
          <button class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex-shrink-0" onclick={() => currentView.set({ name: 'book', id: ownedMatch!.id })}>Voir</button>
        </div>
      {/if}
      {#if groups.length > 0}
        <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Résultats disponibles</span>
      {/if}
      <div class="flex flex-col gap-2.5">
        {#each groups as g (g.series)}
          {#if g.items.length > 1}
            <div
              class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => openSeries(g)}
              onkeydown={(e) => e.key === 'Enter' && openSeries(g)}
            >
              <div class="w-12 aspect-[2/3] rounded-md overflow-hidden bg-light-card dark:bg-app-card flex-shrink-0">
                {#if g.items[0].cover_url}<img src={g.items[0].cover_url} alt={g.series} class="w-full h-full object-cover" />{:else}{@render coverFallback(g.series)}{/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[guessCategory(g.items)]}`}>{CATEGORY_LABEL[guessCategory(g.items)].toUpperCase()}</span>
                </div>
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{g.series}</div>
                <div class="text-xs text-slate-400">{g.items.length} tomes trouvés</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-slate-400 flex-shrink-0"
                ><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg
              >
            </div>
          {:else}
            {@const r = g.items[0]}
            {@const cat = guessCategory([r])}
            <div
              class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => openPreview(r)}
              onkeydown={(e) => e.key === 'Enter' && openPreview(r)}
            >
              <div class="w-12 aspect-[2/3] rounded-md overflow-hidden bg-light-card dark:bg-app-card flex-shrink-0">
                {#if r.cover_url}<img src={r.cover_url} alt={r.title} class="w-full h-full object-cover" />{:else}{@render coverFallback(r.title)}{/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[cat]}`}>{CATEGORY_LABEL[cat].toUpperCase()}</span>
                  {#if r.source}<span class="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{r.source}</span>{/if}
                </div>
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.title}</div>
                <div class="text-xs text-slate-400 truncate">
                  {r.authors.join(', ') || 'Auteur inconnu'}{r.pages ? ` • ${r.pages} p.` : ''}{r.publishedDate ? ` • ${r.publishedDate.slice(0, 4)}` : ''}
                </div>
              </div>
              <button
                class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-medium flex-shrink-0 disabled:opacity-50"
                onclick={(e) => {
                  e.stopPropagation()
                  const pv = parseSeriesVolume(r.title)
                  addBook(r, cat, 'wishlist', pv.volume ? pv.series : null)
                }}
                disabled={adding}
              >
                Importer
              </button>
            </div>
          {/if}
        {/each}
      </div>
      <button class="w-full py-3.5 rounded-xl border border-dashed border-light-border dark:border-app-border text-slate-400 text-sm" onclick={addManual}
        >+ Saisir un livre manuellement</button
      >
    {/if}
  </div>
</div>

{#if previewItem}
  <div class="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center" role="presentation" onclick={() => (previewItem = null)}>
    <div
      class="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto thin-scrollbar p-6 pt-8 rounded-t-3xl sm:rounded-2xl flex flex-col gap-3 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (previewItem = null)}
    >
      <button
        class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border text-slate-500 dark:text-slate-300"
        onclick={() => (previewItem = null)}
        aria-label="Fermer"
      >
        ✕
      </button>
      <div class="w-24 h-36 rounded-xl overflow-hidden bg-light-card dark:bg-app-card mx-auto mb-1 cover-shadow">
        {#if previewItem.cover_url}<img src={previewItem.cover_url} alt={previewItem.title} class="w-full h-full object-cover" />{:else}{@render coverFallback(previewItem.title)}{/if}
      </div>
      <div class="font-serif text-xl font-bold text-slate-900 dark:text-white text-center">{previewItem.title}</div>
      {#if previewItem.subtitle}<div class="text-sm text-slate-500 dark:text-slate-400 text-center -mt-1.5">{previewItem.subtitle}</div>{/if}
      {#if previewItem.authors.length}<div class="text-sm text-slate-500 dark:text-slate-400 text-center">{previewItem.authors.join(', ')}</div>{/if}
      <div class="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
        {#if previewItem.publisher}<span>{previewItem.publisher}</span>{/if}
        {#if previewItem.publishedDate}<span>{previewItem.publishedDate}</span>{/if}
        {#if previewItem.language}<span>{previewItem.language.toUpperCase()}</span>{/if}
        {#if previewItem.pages}<span>{previewItem.pages} p.</span>{/if}
        {#if previewItem.isbn}<span>ISBN {previewItem.isbn}</span>{/if}
      </div>
      {#if previewItem.categories?.length}
        <div class="flex flex-wrap justify-center gap-1.5">
          {#each previewItem.categories as c (c)}<span class="px-2.5 py-1 rounded-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border text-[11px] text-slate-500 dark:text-slate-400">{c}</span>{/each}
        </div>
      {/if}
      {#if previewItem.description}<p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-h-48 overflow-y-auto thin-scrollbar">{previewItem.description}</p>{/if}
      <div class="flex flex-wrap gap-2 justify-center">
        {#each Object.keys(CATEGORY_LABEL) as c (c)}
          <button type="button" class={chipClass(previewCategory === c)} onclick={() => (previewCategory = c as Category)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
      <div class="flex flex-wrap gap-2 justify-center">
        {#each ADD_STATUSES as s (s)}
          <button type="button" class={chipClass(previewStatus === s)} onclick={() => (previewStatus = s as Status)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
      <button
        class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
        onclick={() => {
          const pv = parseSeriesVolume(previewItem!.title)
          addBook(previewItem as BookLookupResult, previewCategory, previewStatus, pv.volume ? pv.series : null)
          previewItem = null
        }}
        disabled={adding}
      >
        Ajouter à ma bibliothèque
      </button>
    </div>
  </div>
{/if}

{#if volumePicker !== null}
  <div class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" role="presentation" onclick={() => (volumePicker = null)}>
    <div
      class="w-full sm:max-w-md max-h-[78vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4 gap-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (volumePicker = null)}
    >
      <div class="flex items-center justify-between font-serif font-bold text-base text-slate-900 dark:text-white">
        <span>Couverture — Tome {volumePicker}</span>
        <button class="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white" onclick={() => (volumePicker = null)} aria-label="Fermer">✕</button>
      </div>
      {#if volumePickerLoading}
        <p class="text-center text-sm text-slate-400 py-5">Recherche…</p>
      {:else if volumePickerCandidates.length === 0}
        <p class="text-center text-sm text-slate-400 py-5">Aucune couverture trouvée pour ce tome.</p>
      {:else}
        <div class="grid grid-cols-3 gap-2.5 overflow-y-auto thin-scrollbar">
          {#each volumePickerCandidates as url (url)}
            <button class="aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent bg-light-card dark:bg-app-card" onclick={() => applyVolumeCover(url)}>
              <img src={url} alt="Option de couverture" loading="lazy" class="w-full h-full object-cover" />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scan-corner {
    position: absolute;
    width: 26px;
    height: 26px;
    border-color: #fff;
    border-style: solid;
    border-width: 0;
  }
  .scan-corner-tl {
    top: 24px;
    left: 24px;
    border-top-width: 2.5px;
    border-left-width: 2.5px;
    border-radius: 8px 0 0 0;
  }
  .scan-corner-tr {
    top: 24px;
    right: 24px;
    border-top-width: 2.5px;
    border-right-width: 2.5px;
    border-radius: 0 8px 0 0;
  }
  .scan-corner-bl {
    bottom: 24px;
    left: 24px;
    border-bottom-width: 2.5px;
    border-left-width: 2.5px;
    border-radius: 0 0 0 8px;
  }
  .scan-corner-br {
    bottom: 24px;
    right: 24px;
    border-bottom-width: 2.5px;
    border-right-width: 2.5px;
    border-radius: 0 0 8px 0;
  }
  .scanline {
    position: absolute;
    left: 24px;
    right: 24px;
    top: 0;
    height: 2px;
    background: #6366f1;
    box-shadow: 0 0 12px 2px rgba(99, 102, 241, 0.7);
    animation: scanline 1.6s linear infinite;
  }
  @keyframes scanline {
    0% {
      transform: translateY(-110%);
    }
    100% {
      transform: translateY(420%);
    }
  }
</style>
