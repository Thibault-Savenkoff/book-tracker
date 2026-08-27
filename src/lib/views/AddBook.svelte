<script lang="ts">
  import { onDestroy } from 'svelte'
  import { supabase } from '../supabase'
  import { currentView } from '../nav'
  import { searchByTitle, lookupByIsbn, LookupNetworkError, type BookLookupResult } from '../bookLookup'
  import { CATEGORY_GRADIENT, CATEGORY_LABEL, STATUS_LABEL } from '../bookStyle'
  import { parseSeriesVolume } from '../series'

  type Category = keyof typeof CATEGORY_LABEL
  type Status = keyof typeof STATUS_LABEL

  let { initialQuery }: { initialQuery?: string } = $props()
  const seedQuery = initialQuery

  let query = $state(seedQuery ?? '')
  let results = $state<BookLookupResult[]>([])
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
    seriesView = null
    if (looksLikeIsbn(q)) {
      await runIsbnLookup(q)
      return
    }
    searching = true
    searchError = null
    isbnNotFound = false
    ownedMatch = null
    try {
      results = await searchByTitle(q)
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
  function openSeries(g: { series: string; items: BookLookupResult[] }) {
    seriesView = g
    seriesCategory = guessCategory(g.items)
    seriesStatus = 'wishlist'
    const volumes = g.items.map((r) => parseSeriesVolume(r.title).volume).filter((v): v is number => v !== null)
    seriesFrom = 1
    seriesTo = volumes.length ? Math.max(...volumes) : g.items.length
  }

  function foundVolume(g: { items: BookLookupResult[] }, n: number): BookLookupResult | null {
    return g.items.find((r) => parseSeriesVolume(r.title).volume === n) ?? null
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
        cover_url: null,
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
</script>

<div class="pb-10 md:max-w-3xl md:mx-auto">
  <div class="p-4 md:p-8 space-y-6">
    <div class="flex items-center gap-3">
      <button
        class="w-9 h-9 rounded-lg bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border flex items-center justify-center flex-shrink-0"
        onclick={() => currentView.set({ name: 'collection' })}
        aria-label="Retour"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <h1 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">Recherche fédérée</h1>
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
        {#each Object.keys(STATUS_LABEL) as s (s)}
          <button type="button" class={chipClass(seriesStatus === s)} onclick={() => (seriesStatus = s as Status)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
      <div class="grid grid-cols-4 sm:grid-cols-6 gap-3.5">
        {#each Array.from({ length: Math.max(0, Math.min(seriesTo, seriesFrom + 199) - seriesFrom + 1) }) as _, i (seriesFrom + i)}
          {@const n = seriesFrom + i}
          {@const match = foundVolume(seriesView, n)}
          <div class="flex flex-col items-center gap-1.5">
            <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-light-card dark:bg-app-card border border-light-border dark:border-app-border">
              {#if match?.cover_url}<img src={match.cover_url} alt="Tome {n}" class="w-full h-full object-cover" />{:else}<div
                  class="w-full h-full"
                  style="background:{CATEGORY_GRADIENT[seriesCategory]}"
                ></div>{/if}
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
      <div class="flex items-center gap-2 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" class="text-indigo-600 dark:text-indigo-400 flex-shrink-0"
          ><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
        <input
          placeholder="Titre, auteur ou ISBN"
          bind:value={query}
          onkeydown={(e) => e.key === 'Enter' && runSearch()}
          class="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
        />
        <button
          class="w-8 h-8 rounded-full bg-light-card dark:bg-app-card flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400"
          onclick={openScanner}
          aria-label="Scanner un code-barre"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
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
      <div class="flex flex-col gap-2">
        {#each groups as g (g.series)}
          {#if g.items.length > 1}
            <div
              class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => openSeries(g)}
              onkeydown={(e) => e.key === 'Enter' && openSeries(g)}
            >
              <div class="w-11 h-16 rounded-md overflow-hidden bg-light-card dark:bg-app-card flex-shrink-0">
                {#if g.items[0].cover_url}<img src={g.items[0].cover_url} alt={g.series} class="w-full h-full object-cover" />{:else}<div
                    class="w-full h-full"
                    style="background:{CATEGORY_GRADIENT.roman}"
                  ></div>{/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{g.series}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">{g.items.length} tomes trouvés</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-slate-400 flex-shrink-0"
                ><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg
              >
            </div>
          {:else}
            {@const r = g.items[0]}
            <div
              class="flex items-center gap-3 p-3 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => openPreview(r)}
              onkeydown={(e) => e.key === 'Enter' && openPreview(r)}
            >
              <div class="w-11 h-16 rounded-md overflow-hidden bg-light-card dark:bg-app-card flex-shrink-0">
                {#if r.cover_url}<img src={r.cover_url} alt={r.title} class="w-full h-full object-cover" />{:else}<div class="w-full h-full" style="background:{CATEGORY_GRADIENT.roman}"></div>{/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.title}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{r.authors.join(', ')}</div>
              </div>
              <button
                class="w-8 h-8 rounded-full bg-indigo-600 text-white text-lg font-semibold flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                onclick={(e) => {
                  e.stopPropagation()
                  const pv = parseSeriesVolume(r.title)
                  addBook(r, guessCategory([r]), 'wishlist', pv.volume ? pv.series : null)
                }}
                disabled={adding}
                aria-label="Ajouter"
              >
                +
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
        {#if previewItem.cover_url}<img src={previewItem.cover_url} alt={previewItem.title} class="w-full h-full object-cover" />{:else}<div
            class="w-full h-full"
            style="background:{CATEGORY_GRADIENT[previewCategory]}"
          ></div>{/if}
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
        {#each Object.keys(STATUS_LABEL) as s (s)}
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
