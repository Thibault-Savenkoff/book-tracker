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

  /** Devine la catégorie à partir des tags Google Books, sinon d'un indice grossier (série avec
   * plusieurs tomes -> manga, le cas le plus fréquent ici). Simple pré-remplissage, pas une vérité :
   * l'utilisateur peut toujours corriger via les chips avant d'ajouter. */
  function guessCategory(items: BookLookupResult[]): Category {
    const text = items
      .flatMap((i) => i.categories ?? [])
      .join(' ')
      .toLowerCase()
    if (text.includes('manga')) return 'manga'
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
</script>

<div class="page">
  <div class="top">
    <button class="back" onclick={() => currentView.set({ name: 'collection' })} aria-label="Retour">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        ><path d="M15 5l-7 7 7 7" stroke="#f2f2f5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg
      >
    </button>
    <div class="title">Recherche</div>
  </div>

  <div class="body">
    {#if scannerOpen}
      <div class="scan-frame">
        <div id="scanner"></div>
        <div class="corner tl"></div>
        <div class="corner tr"></div>
        <div class="corner bl"></div>
        <div class="corner br"></div>
        {#if scanState === 'scanning'}<div class="scanline"></div>{/if}
      </div>
      {#if scanError}<p class="hint error">{scanError}</p>{/if}
      {#if searching}<p class="hint">Recherche du livre…</p>{/if}
      {#if ownedMatch}
        <div class="owned-card glass">
          <div class="owned-check">✓</div>
          <div class="mid">
            <div class="rtitle">Tu l'as déjà</div>
            <div class="rauthor">{ownedMatch.title} — {STATUS_LABEL[ownedMatch.status]}</div>
          </div>
        </div>
        <button class="go-btn wide" onclick={() => currentView.set({ name: 'book', id: ownedMatch!.id })}>Voir la fiche</button>
        <button class="go-btn wide secondary" onclick={scanAgain}>Scanner un autre livre</button>
      {:else if isbnNotFound}
        <p class="hint">Aucun livre trouvé pour ce code-barre.</p>
        <button class="go-btn wide" onclick={scanAgain}>Scanner un autre livre</button>
      {/if}
      <button class="go-btn wide secondary" onclick={stopScanner}>Fermer le scanner</button>
    {:else if seriesView}
      <button class="series-back" onclick={() => (seriesView = null)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path d="M15 5l-7 7 7 7" stroke="var(--text-dim)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
        Retour aux résultats
      </button>
      <div class="series-title-row">
        <div class="series-title">{seriesView.series}</div>
        <div class="series-sub">{seriesView.items[0].authors.join(', ')}</div>
      </div>
      <p class="hint">Google ne connaît pas la liste complète des tomes d'une série — indique la plage que tu possèdes, les couvertures des tomes trouvés seront utilisées automatiquement.</p>
      <div class="range-row">
        <label>Du tome<input type="number" min="1" bind:value={seriesFrom} /></label>
        <label>Au tome<input type="number" min="1" bind:value={seriesTo} /></label>
      </div>
      <div class="chip-group">
        {#each Object.keys(CATEGORY_LABEL) as c (c)}
          <button type="button" class="chip" class:active={seriesCategory === c} onclick={() => (seriesCategory = c as Category)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
      <div class="chip-group">
        {#each Object.keys(STATUS_LABEL) as s (s)}
          <button type="button" class="chip" class:active={seriesStatus === s} onclick={() => (seriesStatus = s as Status)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
      <div class="tome-grid">
        {#each Array.from({ length: Math.max(0, Math.min(seriesTo, seriesFrom + 199) - seriesFrom + 1) }) as _, i (seriesFrom + i)}
          {@const n = seriesFrom + i}
          {@const match = foundVolume(seriesView, n)}
          <div class="tome-cell">
            <div class="tome-cover">
              {#if match?.cover_url}<img src={match.cover_url} alt="Tome {n}" />{:else}<div class="fallback" style="background:{CATEGORY_GRADIENT[seriesCategory]}"></div>{/if}
            </div>
            <div class="tome-label">T{n}</div>
          </div>
        {/each}
      </div>
      <button class="go-btn wide" onclick={addSeriesRange} disabled={adding || seriesTo < seriesFrom}>
        Ajouter les tomes {Math.min(seriesFrom, seriesTo)} à {Math.max(seriesFrom, seriesTo)}
      </button>
    {:else}
      <div class="search-box glass">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          ><circle cx="11" cy="11" r="7" stroke="rgba(242, 242, 245,0.5)" stroke-width="2" /><path
            d="M21 21l-4.3-4.3"
            stroke="rgba(242, 242, 245,0.5)"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
        <input placeholder="Titre, auteur ou ISBN" bind:value={query} onkeydown={(e) => e.key === 'Enter' && runSearch()} />
        <button class="scan-btn" onclick={openScanner} aria-label="Scanner un code-barre">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            ><path
              d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M7 12h10"
              stroke="rgba(242, 242, 245,0.65)"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        </button>
      </div>
      {#if searching}<p class="hint">Recherche…</p>{/if}
      {#if searchError}<p class="hint error">{searchError}</p>{/if}
      {#if !searching && !searchError && query.trim() && results.length === 0 && !isbnNotFound && !ownedMatch}<p class="hint">Aucun résultat.</p>{/if}
      {#if isbnNotFound}<p class="hint">Aucun livre trouvé pour cet ISBN.</p>{/if}
      {#if ownedMatch}
        <div class="owned-card glass">
          <div class="owned-check">✓</div>
          <div class="mid">
            <div class="rtitle">Tu l'as déjà</div>
            <div class="rauthor">{ownedMatch.title} — {STATUS_LABEL[ownedMatch.status]}</div>
          </div>
          <button class="go-btn small" onclick={() => currentView.set({ name: 'book', id: ownedMatch!.id })}>Voir</button>
        </div>
      {/if}
      <div class="results">
        {#each groups as g (g.series)}
          {#if g.items.length > 1}
            <div class="result glass" role="button" tabindex="0" onclick={() => openSeries(g)} onkeydown={(e) => e.key === 'Enter' && openSeries(g)}>
              <div class="cover">
                {#if g.items[0].cover_url}<img src={g.items[0].cover_url} alt={g.series} />{:else}<div class="fallback" style="background:{CATEGORY_GRADIENT.roman}"></div>{/if}
              </div>
              <div class="mid">
                <div class="rtitle">{g.series}</div>
                <div class="rauthor">{g.items.length} tomes trouvés</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                ><path d="M9 5l7 7-7 7" stroke="var(--text-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg
              >
            </div>
          {:else}
            {@const r = g.items[0]}
            <div class="result glass" role="button" tabindex="0" onclick={() => openPreview(r)} onkeydown={(e) => e.key === 'Enter' && openPreview(r)}>
              <div class="cover">
                {#if r.cover_url}<img src={r.cover_url} alt={r.title} />{:else}<div class="fallback" style="background:{CATEGORY_GRADIENT.roman}"></div>{/if}
              </div>
              <div class="mid">
                <div class="rtitle">{r.title}</div>
                <div class="rauthor">{r.authors.join(', ')}</div>
              </div>
              <button
                class="add-btn"
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
      <button class="manual" onclick={addManual}>+ Saisir un livre manuellement</button>
    {/if}
  </div>
</div>

{#if previewItem}
  <div class="preview-backdrop" role="presentation" onclick={() => (previewItem = null)}>
    <div
      class="preview-card glass"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (previewItem = null)}
    >
      <button class="preview-close" onclick={() => (previewItem = null)} aria-label="Fermer">✕</button>
      <div class="preview-cover">
        {#if previewItem.cover_url}<img src={previewItem.cover_url} alt={previewItem.title} />{:else}<div class="fallback" style="background:{CATEGORY_GRADIENT[previewCategory]}"></div>{/if}
      </div>
      <div class="preview-title">{previewItem.title}</div>
      {#if previewItem.subtitle}<div class="preview-subtitle">{previewItem.subtitle}</div>{/if}
      {#if previewItem.authors.length}<div class="preview-authors">{previewItem.authors.join(', ')}</div>{/if}
      <div class="preview-meta">
        {#if previewItem.publisher}<span>{previewItem.publisher}</span>{/if}
        {#if previewItem.publishedDate}<span>{previewItem.publishedDate}</span>{/if}
        {#if previewItem.language}<span>{previewItem.language.toUpperCase()}</span>{/if}
        {#if previewItem.pages}<span>{previewItem.pages} p.</span>{/if}
        {#if previewItem.isbn}<span>ISBN {previewItem.isbn}</span>{/if}
      </div>
      {#if previewItem.categories?.length}
        <div class="preview-tags">
          {#each previewItem.categories as c (c)}<span class="tag">{c}</span>{/each}
        </div>
      {/if}
      {#if previewItem.description}<p class="preview-desc">{previewItem.description}</p>{/if}
      <div class="chip-group">
        {#each Object.keys(CATEGORY_LABEL) as c (c)}
          <button type="button" class="chip" class:active={previewCategory === c} onclick={() => (previewCategory = c as Category)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
      <div class="chip-group">
        {#each Object.keys(STATUS_LABEL) as s (s)}
          <button type="button" class="chip" class:active={previewStatus === s} onclick={() => (previewStatus = s as Status)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>
      <button
        class="go-btn wide"
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
  .page {
    padding-bottom: 40px;
  }
  @media (min-width: 900px) {
    .page {
      max-width: 640px;
      margin: 0 auto;
    }
  }
  .top {
    padding: 58px 22px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .title {
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 22px;
  }
  .body {
    padding: 16px 22px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 12px 12px 15px;
  }
  .search-box input {
    border: none;
    background: none;
    outline: none;
    color: var(--text);
    font-size: 14.5px;
    flex: 1;
  }
  .scan-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .go-btn {
    padding: 0 20px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--text);
    color: var(--bg);
    font-weight: 700;
    font-size: 13px;
  }
  .go-btn.small {
    padding: 9px 15px;
    font-size: 12.5px;
  }
  .go-btn.wide {
    width: 100%;
    padding: 15px;
    border-radius: 18px;
    font-size: 14.5px;
  }
  .go-btn.secondary {
    margin-top: 8px;
    background: transparent;
    border: 1px solid var(--glass-border);
    color: var(--text-dim);
  }
  .hint {
    font-size: 13px;
    color: var(--text-faint);
    padding: 4px 2px;
  }
  .hint.error {
    color: var(--danger);
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .result {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px;
    cursor: pointer;
  }
  .owned-card {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border-color: var(--accent);
  }
  .owned-check {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .series-back {
    display: flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 12.5px;
    font-weight: 600;
    padding: 4px 2px;
  }
  .series-title-row {
    padding: 2px 2px 4px;
  }
  .series-title {
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 19px;
  }
  .series-sub {
    font-size: 12px;
    color: var(--text-faint);
    margin-top: 2px;
  }
  .tome-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 14px;
    padding-bottom: 12px;
  }
  .tome-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 0;
  }
  .tome-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2/3;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-alt);
    border: 2px solid transparent;
  }
  .tome-cover img,
  .tome-cover .fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tome-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
  }
  .range-row {
    display: flex;
    gap: 12px;
  }
  .range-row label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
    color: var(--text-faint);
  }
  .range-row input {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: var(--text);
    font-size: 14px;
  }
  .preview-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 50;
  }
  @media (min-width: 900px) {
    .preview-backdrop {
      align-items: center;
    }
  }
  .preview-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    max-height: 88vh;
    overflow-y: auto;
    padding: 26px 22px 22px;
    border-radius: 24px 24px 0 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (min-width: 900px) {
    .preview-card {
      border-radius: var(--radius-lg);
      max-height: 80vh;
    }
  }
  .preview-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--glass-border);
    color: var(--text);
  }
  .preview-cover {
    width: 96px;
    height: 140px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-alt);
    margin: 0 auto 4px;
  }
  .preview-cover img,
  .preview-cover .fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .preview-title {
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 19px;
    text-align: center;
  }
  .preview-subtitle {
    font-size: 13px;
    color: var(--text-dim);
    text-align: center;
    margin-top: -6px;
  }
  .preview-authors {
    font-size: 13.5px;
    color: var(--text-dim);
    text-align: center;
  }
  .preview-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 12px;
    font-size: 11.5px;
    color: var(--text-faint);
  }
  .preview-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  .tag {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--glass-border);
    font-size: 11px;
    color: var(--text-dim);
  }
  .preview-desc {
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-dim);
    max-height: 200px;
    overflow-y: auto;
  }
  .cover {
    width: 42px;
    height: 62px;
    border-radius: 8px;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--bg-alt);
  }
  .cover img,
  .cover .fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .mid {
    flex: 1;
    min-width: 0;
  }
  .rtitle {
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rauthor {
    font-size: 12.5px;
    color: var(--text-dim);
    margin-top: 2px;
  }
  .add-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--text);
    border: none;
    color: var(--bg);
    font-size: 17px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .chip-group .chip {
    border: 1px solid var(--glass-border);
    padding: 6px 13px;
    font-size: 12px;
  }
  .scan-frame {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 24px;
    background: #0e0f13;
    overflow: hidden;
    border: 1px solid var(--glass-border);
  }
  .corner {
    position: absolute;
    width: 26px;
    height: 26px;
    border-color: var(--text);
    border-style: solid;
    border-width: 0;
  }
  .corner.tl {
    top: 24px;
    left: 24px;
    border-top-width: 2.5px;
    border-left-width: 2.5px;
    border-radius: 8px 0 0 0;
  }
  .corner.tr {
    top: 24px;
    right: 24px;
    border-top-width: 2.5px;
    border-right-width: 2.5px;
    border-radius: 0 8px 0 0;
  }
  .corner.bl {
    bottom: 24px;
    left: 24px;
    border-bottom-width: 2.5px;
    border-left-width: 2.5px;
    border-radius: 0 0 0 8px;
  }
  .corner.br {
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
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    box-shadow: 0 0 12px 2px rgba(139, 143, 255, 0.7);
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
  .manual {
    margin-top: 8px;
    padding: 13px;
    border-radius: var(--radius-md);
    border: 1px dashed rgba(255, 255, 255, 0.18);
    background: transparent;
    color: var(--text-faint);
    font-size: 13px;
  }
</style>
