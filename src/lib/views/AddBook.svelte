<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { supabase } from '../supabase'
  import { currentView } from '../nav'
  import {
    searchByTitle,
    lookupByIsbn,
    expandAlias,
    fetchMangaDexCovers,
    getSeriesVolumeCount,
    LookupNetworkError,
    type BookLookupResult,
    type SearchLatencies,
  } from '../bookLookup'
  import { CATEGORY_LABEL, CATEGORY_BADGE_CLASS, STATUS_LABEL, chipClass } from '../bookStyle'
  import CoverFallback from './CoverFallback.svelte'
  import BookPreviewModal from './BookPreviewModal.svelte'
  import VolumeCoverPicker from './VolumeCoverPicker.svelte'
  import { parseSeriesVolume } from '../series'
  import { createBarcodeScanner } from '../scanner'
  import { guessCategory, looksLikeIsbn, groupBySeries, foundVolume, volumeRange, bookRow } from '../addBook'

  type Category = keyof typeof CATEGORY_LABEL
  type Status = keyof typeof STATUS_LABEL
  // ponytail: "Abandonné" n'a pas de sens au moment d'ajouter un livre, seulement depuis la fiche.
  const ADD_STATUSES: Status[] = ['wishlist', 'reading', 'read']

  let { initialQuery }: { initialQuery?: string } = $props()
  // untrack : la requête initiale ne sert qu'à amorcer le champ au montage. La rendre réactive
  // écraserait ce que l'utilisateur est en train de taper.
  const seedQuery = untrack(() => initialQuery)

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
  let seriesView = $state<{ series: string; items: BookLookupResult[] } | null>(null)
  let seriesCategory = $state<Category>('manga')
  let seriesStatus = $state<Status>('wishlist')
  let seriesFrom = $state(1)
  let seriesTo = $state(1)
  let seriesCovers = $state<Record<number, string[]>>({})
  let seriesCoversLoading = $state(false)
  let isSearchingVolume = $state<Record<number, boolean>>({})
  let excludedVolumes = $state<Set<number>>(new Set())
  let collectorVolumes = $state<Set<number>>(new Set())
  let volumeIsbnOverride = $state<Record<number, BookLookupResult>>({})
  let volumePicker = $state<number | null>(null)
  const mainScanner = createBarcodeScanner()
  let scannerOpen = $state(false)
  let scanError = $state<string | null>(null)
  let adding = $state(false)
  let addSeriesError = $state<string | null>(null)
  /** Tomes de cette série déjà en bibliothèque : décochés d'office et signalés, pour qu'un
   * second passage sur la même série ne crée pas de doublons. */
  let ownedVolumes = $state<Set<number>>(new Set())

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
      // limit(1) et pas maybeSingle() : posséder deux exemplaires d'un même ISBN est un cas
      // prévu (édition collector), et maybeSingle() renvoie une erreur dès qu'il y a 2 lignes.
      const { data: owned } = await supabase.from('books').select('id,title,status').eq('isbn', isbn).limit(1)
      if (owned?.length) {
        ownedMatch = owned[0]
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
    return supabase.from('books').insert(bookRow(result, userId, category, status, series)).select().single()
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
  }

  function addManual() {
    addBook({ isbn: null, title: '', authors: [], publisher: null, cover_url: null, pages: null })
  }

  const groups = $derived(groupBySeries(results))

  /** Google Books ne renvoie qu'un échantillon partiel et dans le désordre pour une recherche par
   * série (vérifié : 20 résultats sur 42 tomes réels, non consécutifs) — impossible de s'y fier pour
   * énumérer une série complète. On demande donc une plage de tomes à l'utilisateur et on génère les
   * entrées ; les tomes réellement trouvés dans les résultats récupèrent leur vraie couverture/ISBN. */
  async function openSeries(g: { series: string; items: BookLookupResult[] }) {
    seriesView = g
    seriesCategory = guessCategory(g.items)
    seriesStatus = 'wishlist'
    seriesCovers = {}
    excludedVolumes = new Set()
    collectorVolumes = new Set()
    volumeIsbnOverride = {}
    ownedVolumes = new Set()
    loadOwnedVolumes(g.series)
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

  /** Rien n'empêchait jusqu'ici d'ajouter deux fois la même série : on lit les tomes déjà
   * possédés pour les décocher avant que l'utilisateur ne valide. Comparaison sur le nom de
   * série normalisé, la casse et les espaces variant selon la source qui a servi à l'ajout. */
  async function loadOwnedVolumes(series: string) {
    const { data } = await supabase.from('books').select('title,series').not('series', 'is', null)
    if (!data || seriesView?.series !== series) return
    const key = series.trim().toLowerCase().replace(/\s+/g, ' ')
    const owned = new Set<number>()
    for (const b of data) {
      if ((b.series ?? '').trim().toLowerCase().replace(/\s+/g, ' ') !== key) continue
      const v = parseSeriesVolume(b.title).volume
      if (v !== null) owned.add(v)
    }
    ownedVolumes = owned
    excludedVolumes = new Set([...excludedVolumes, ...owned])
  }

  // $derived (pas un simple calcul dans le template) : se recalcule dès que fromVolume/toVolume
  // changent, ce qui redéclenche l'effet de chargement des couvertures ci-dessous.
  const seriesVolumeList = $derived(seriesView ? volumeRange(seriesFrom, seriesTo) : [])

  /** Une recherche globale sur la série ne remonte qu'un échantillon partiel et désordonné
   * (vérifié : 20 résultats sur 42 tomes réels) — on cible donc explicitement "Tome N" pour
   * chaque tome resté sans couverture (ni résultat de recherche, ni MangaDex). */
  async function loadMissingCover(seriesTitle: string, volNumber: number) {
    if (seriesCovers[volNumber]?.length || isSearchingVolume[volNumber]) return
    isSearchingVolume[volNumber] = true
    try {
      const q = encodeURIComponent(`intitle:"${seriesTitle}" "tome ${volNumber}"`)
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`)
      const data = await res.json()
      const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      if (img) seriesCovers[volNumber] = [img.replace('http://', 'https://')]
    } catch (e) {
      console.error(`Erreur cover T${volNumber}`, e)
    } finally {
      isSearchingVolume[volNumber] = false
    }
  }

  /** Par lots de 5 en parallèle plutôt que tout d'un coup : évite de saturer l'API Google Books
   * sur une grande plage (ex. 1 à 42) et de se faire rate-limiter. */
  async function loadMissingCoversBatched(g: { series: string; items: BookLookupResult[] }, volumes: number[]) {
    const missing = volumes.filter((n) => !foundVolume(g, n)?.cover_url && !seriesCovers[n]?.length && !isSearchingVolume[n])
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(missing.slice(i, i + 5).map((n) => loadMissingCover(g.series, n)))
    }
  }

  // untrack : cet effet ne doit se redéclencher que quand la plage de tomes change, pas à chaque
  // couverture trouvée (loadMissingCover écrit dans seriesCovers/isSearchingVolume, lus par le
  // filtre de loadMissingCoversBatched — sans untrack, ça re-déclenche l'effet des dizaines de fois).
  $effect(() => {
    if (seriesView && seriesVolumeList.length) {
      const g = seriesView
      const vols = seriesVolumeList
      untrack(() => loadMissingCoversBatched(g, vols))
    }
  })

  /** Cliquer sur la vignette permet de remplacer la couverture manuellement à tout moment (pas
   * seulement si elle manque) — utile pour une édition collector qui n'a pas la même couverture.
   * Les alternatives MangaDex déjà récupérées (fr/ja) sont de vraies jaquettes de CE tome — on les
   * propose d'abord, Google Books ne sert qu'à compléter (il ne connaît souvent que l'édition
   * standard, jamais une collector, et ses résultats sans rapport ont déjà fait plus de mal que de bien). */
  function pickVolumeCover(n: number) {
    volumePicker = n
  }

  function applyVolumeCover(url: string) {
    if (volumePicker === null) return
    seriesCovers = { ...seriesCovers, [volumePicker]: [url] }
    volumePicker = null
  }

  /** Un scan remplace l'édition entière du tome, pas seulement sa couverture : l'ISBN scanné
   * identifie l'exemplaire que l'utilisateur a en main. */
  function applyVolumeScan(result: BookLookupResult) {
    if (volumePicker === null) return
    const n = volumePicker
    volumeIsbnOverride = { ...volumeIsbnOverride, [n]: result }
    if (result.cover_url) seriesCovers = { ...seriesCovers, [n]: [result.cover_url, ...(seriesCovers[n] ?? [])] }
    volumePicker = null
  }

  function toggleVolumeIncluded(n: number) {
    const s = new Set(excludedVolumes)
    if (s.has(n)) s.delete(n)
    else s.add(n)
    excludedVolumes = s
  }

  // L'édition collector a presque toujours une jaquette différente de l'édition standard —
  // cocher ★ doit donc immédiatement proposer cette couverture, pas juste taguer le titre.
  function toggleVolumeCollector(n: number) {
    const s = new Set(collectorVolumes)
    const turningOn = !s.has(n)
    if (turningOn) s.add(n)
    else s.delete(n)
    collectorVolumes = s
    if (turningOn) pickVolumeCover(n)
  }

  // Nombre de tomes réellement ajoutés : la plage moins ce que l'utilisateur a décoché (déjà possédé,
  // édition différente, etc.) — la plage seule ne dit plus combien de livres seront créés.
  const includedVolumeCount = $derived(seriesVolumeList.filter((n) => !excludedVolumes.has(n)).length)

  /** Construit la ligne d'un tome : l'override de scan prime sur le résultat de recherche
   * générique (qui peut être une autre édition), et à défaut on fabrique un titre minimal. */
  function seriesVolumeRow(view: { series: string; items: BookLookupResult[] }, n: number): BookLookupResult {
    const base: BookLookupResult = volumeIsbnOverride[n] ??
      foundVolume(view, n) ?? {
        isbn: null,
        title: `${view.series} Tome ${n}`,
        authors: view.items[0].authors,
        publisher: view.items[0].publisher,
        cover_url: null,
        pages: null,
      }
    const withCover = { ...base, cover_url: seriesCovers[n]?.[0] ?? base.cover_url }
    return collectorVolumes.has(n) ? { ...withCover, title: `${withCover.title} (Édition collector)` } : withCover
  }

  async function addSeriesRange() {
    if (adding || !seriesView) return
    adding = true
    addSeriesError = null
    const view = seriesView
    const { data: userData } = await supabase.auth.getUser()
    // Un insert par tome, c'est un aller-retour réseau par tome (100 pour une longue série) et
    // une série à moitié créée si l'un échoue. supabase-js accepte un tableau : une seule requête.
    const rows = seriesVolumeList
      .filter((n) => !excludedVolumes.has(n))
      .map((n) => bookRow(seriesVolumeRow(view, n), userData.user?.id, seriesCategory, seriesStatus, view.series))
    const { error } = await supabase.from('books').insert(rows)
    adding = false
    if (error) {
      addSeriesError = "Ajout impossible — aucun tome n'a été créé."
      return
    }
    seriesView = null
    currentView.set({ name: 'collection' })
  }

  let scanState = $state<'idle' | 'scanning'>('idle')

  async function openScanner() {
    scanError = null
    isbnNotFound = false
    ownedMatch = null
    scannerOpen = true
    scanState = 'scanning'
    const started = await mainScanner.start('scanner', runIsbnLookup)
    if (!started) {
      scanError = "Impossible d'accéder à la caméra (HTTPS requis, vérifie les permissions)."
      scanState = 'idle'
    }
  }

  function scanAgain() {
    isbnNotFound = false
    ownedMatch = null
    mainScanner.resume()
  }

  function stopScanner() {
    mainScanner.stop()
    scannerOpen = false
    scanState = 'idle'
  }

  onDestroy(stopScanner)

  if (seedQuery) runSearch()

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
      <p class="text-xs text-slate-400 leading-relaxed -mt-2">
        Décoche les tomes que tu ne veux pas ajouter (déjà possédés, pas encore acquis…). Marque
        <span class="text-amber-500 font-semibold">★</span> une édition collector — clique sur la couverture pour la remplacer.
      </p>
      {#if ownedVolumes.size}
        <p class="text-xs text-indigo-500 dark:text-indigo-400 leading-relaxed -mt-3">
          {ownedVolumes.size} tome{ownedVolumes.size > 1 ? 's' : ''} déjà dans ta bibliothèque, décoché{ownedVolumes.size > 1 ? 's' : ''} pour éviter les doublons.
        </p>
      {/if}
      <div class="grid grid-cols-4 sm:grid-cols-6 gap-3.5">
        {#each seriesVolumeList as n (n)}
          {@const match = foundVolume(seriesView, n)}
          {@const cover = match?.cover_url ?? seriesCovers[n]?.[0]}
          {@const searching = isSearchingVolume[n]}
          {@const excluded = excludedVolumes.has(n)}
          {@const collector = collectorVolumes.has(n)}
          {@const owned = ownedVolumes.has(n)}
          <div class="flex flex-col items-center gap-1.5" class:opacity-40={excluded}>
            <div
              class="relative w-full aspect-[2/3] rounded-lg overflow-hidden cursor-pointer bg-light-card dark:bg-app-card border-2"
              class:border-amber-400={collector}
              class:border-light-border={!collector}
              class:dark:border-app-border={!collector}
              class:animate-pulse={searching && !cover}
              role="button"
              tabindex="0"
              onclick={() => pickVolumeCover(n)}
              onkeydown={(e) => e.key === 'Enter' && pickVolumeCover(n)}
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
                <CoverFallback title={`T${n}`} />
              {/if}
              {#if owned}
                <span class="absolute bottom-0 inset-x-0 py-0.5 text-[9px] font-mono text-center bg-indigo-600/90 text-white">POSSÉDÉ</span>
              {/if}
              <button
                type="button"
                class="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border border-white/70"
                class:bg-indigo-600={!excluded}
                class:text-white={!excluded}
                class:bg-white={excluded}
                class:text-slate-400={excluded}
                onclick={(e) => {
                  e.stopPropagation()
                  toggleVolumeIncluded(n)
                }}
                title={excluded ? 'Inclure ce tome' : 'Exclure ce tome'}
              >
                {excluded ? '' : '✓'}
              </button>
              <button
                type="button"
                class="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] border border-white/70 {collector ? 'bg-amber-400 text-white' : 'bg-black/40 text-white/70'}"
                onclick={(e) => {
                  e.stopPropagation()
                  toggleVolumeCollector(n)
                }}
                title={collector ? 'Édition collector (cliquer pour retirer)' : 'Marquer édition collector'}
              >
                ★
              </button>
            </div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">T{n}</div>
          </div>
        {/each}
      </div>
      {#if addSeriesError}
        <p class="text-xs text-red-500 text-center">{addSeriesError}</p>
      {/if}
      <button
        class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
        onclick={addSeriesRange}
        disabled={adding || includedVolumeCount === 0}
      >
        {adding ? 'Ajout…' : `Ajouter ${includedVolumeCount} tome${includedVolumeCount > 1 ? 's' : ''}`}
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
                {#if g.items[0].cover_url}<img src={g.items[0].cover_url} alt={g.series} class="w-full h-full object-cover" />{:else}<CoverFallback title={g.series} />{/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[guessCategory(g.items)]}`}>{CATEGORY_LABEL[guessCategory(g.items)].toUpperCase()}</span>
                </div>
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{g.series}</div>
                <div class="text-xs text-slate-400">{g.items.length} résultat{g.items.length > 1 ? 's' : ''} (au moins)</div>
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
                {#if r.cover_url}<img src={r.cover_url} alt={r.title} class="w-full h-full object-cover" />{:else}<CoverFallback title={r.title} />{/if}
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
  <BookPreviewModal
    item={previewItem}
    {adding}
    onclose={() => (previewItem = null)}
    onadd={(item, category, status, series) => {
      addBook(item, category, status, series)
      previewItem = null
    }}
  />
{/if}

{#if volumePicker !== null && seriesView}
  <VolumeCoverPicker
    seriesTitle={seriesView.series}
    volume={volumePicker}
    isCollector={collectorVolumes.has(volumePicker)}
    knownCovers={seriesCovers[volumePicker] ?? []}
    onclose={() => (volumePicker = null)}
    onpick={applyVolumeCover}
    onscanned={applyVolumeScan}
  />
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
