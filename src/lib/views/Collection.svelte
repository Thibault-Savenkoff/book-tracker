<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_GRADIENT, STATUS_LABEL } from '../bookStyle'
  import { parseSeriesVolume } from '../series'

  let books = $state<Book[]>([])
  let loading = $state(true)
  let query = $state('')
  let filterCategory = $state<string>('Toutes')
  let resultsAsList = $state(false)
  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']

  async function load() {
    loading = true
    const { data } = await supabase.from('books').select('*').order('date_added', { ascending: false })
    books = data ?? []
    loading = false
  }
  load()

  const resultsActive = $derived(query.trim() !== '' || filterCategory !== 'Toutes')

  const filtered = $derived(
    books.filter(
      (b) =>
        (filterCategory === 'Toutes' || b.category === filterCategory) &&
        (!query.trim() || `${b.title} ${b.authors.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),
    ),
  )

  /** "One Piece" et "One Piece " (espace/casse en trop selon la façon dont le livre a été
   * ajouté) doivent former une seule série — on regroupe sur une clé normalisée. */
  function normSeries(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  /** Regroupe par série (colonne `books.series`, remplie à l'ajout) et déduit les tomes manquants
   * à partir des numéros trouvés dans le titre : les trous entre le min et le max possédés.
   * Calculé sur la collection entière (pas le filtre courant) : c'est un état permanent de la
   * bibliothèque, pas un résultat de recherche. */
  const seriesGroups = $derived.by(() => {
    const map = new Map<string, Book[]>()
    for (const b of books) {
      if (!b.series) continue
      const key = normSeries(b.series)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    return [...map.entries()]
      .map(([, list]) => {
        const series = list[0].series!
        const owned = list
          .map((b) => ({ book: b, volume: parseSeriesVolume(b.title).volume }))
          .sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0))
        const volumes = owned.map((o) => o.volume).filter((v): v is number => v !== null)
        const missing: number[] = []
        if (volumes.length) {
          const min = Math.min(...volumes)
          const max = Math.max(...volumes)
          for (let n = min; n <= max; n++) if (!volumes.includes(n)) missing.push(n)
        }
        return { series, owned, missing, cover_url: list.find((b) => b.cover_url)?.cover_url ?? null, category: list[0].category }
      })
      .filter((g) => g.missing.length > 0)
      .sort((a, b) => a.series.localeCompare(b.series))
  })

  /** Un item affiché : un livre seul, ou une série regroupée sous une seule carte — affiche
   * "One Piece · 12 tomes" au lieu de 12 cartes identiques "One Piece Tome N". */
  type DisplayItem =
    | { kind: 'book'; key: string; book: Book }
    | { kind: 'series'; key: string; series: string; count: number; cover_url: string | null; category: string; status: Book['status'] }

  // ponytail: filtre par série en O(n²) sur la liste déjà filtrée, sans conséquence pour une collection perso
  function groupDisplay(list: Book[]): DisplayItem[] {
    const items: DisplayItem[] = []
    const seen = new Set<string>()
    for (const b of list) {
      if (!b.series) {
        items.push({ kind: 'book', key: b.id, book: b })
        continue
      }
      const key = normSeries(b.series)
      if (seen.has(key)) continue
      seen.add(key)
      const group = list.filter((x) => x.series && normSeries(x.series) === key)
      if (group.length === 1) {
        items.push({ kind: 'book', key: b.id, book: b })
        continue
      }
      const anyReading = group.some((x) => x.status === 'reading')
      const allRead = group.every((x) => x.status === 'read')
      items.push({
        kind: 'series',
        key: `series:${key}`,
        series: b.series,
        count: group.length,
        cover_url: group.find((x) => x.cover_url)?.cover_url ?? null,
        category: group[0].category,
        status: anyReading ? 'reading' : allRead ? 'read' : 'wishlist',
      })
    }
    return items
  }

  const shelves = $derived.by(() => {
    if (resultsActive) return []
    return (['reading', 'read', 'wishlist'] as const).map((status) => ({
      status,
      label: status === 'reading' ? 'En cours de lecture' : status === 'read' ? 'Déjà lus' : 'Envie de lire',
      items: groupDisplay(books.filter((b) => b.status === status)),
    }))
  })

  const resultsDisplay = $derived(resultsActive ? groupDisplay(filtered) : [])

  function openItem(item: DisplayItem) {
    if (item.kind === 'book') currentView.set({ name: 'book', id: item.book.id })
    else {
      filterCategory = 'Toutes'
      query = item.series
    }
  }

  async function markFinished(b: Book, e: Event) {
    e.stopPropagation()
    const date_read = new Date().toISOString().slice(0, 10)
    await supabase.from('books').update({ status: 'read', date_read }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, status: 'read', date_read } : x))
  }

  async function markReading(b: Book, e: Event) {
    e.stopPropagation()
    await supabase.from('books').update({ status: 'reading' }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, status: 'reading' } : x))
  }

  function signOut() {
    if (confirm('Se déconnecter ?')) supabase.auth.signOut()
  }

  function stampDate(d: string | null): string {
    if (!d) return ''
    return new Date(`${d}T00:00:00`)
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      .toUpperCase()
      .replace('.', '')
  }
</script>

{#snippet spineCard(item: DisplayItem)}
  <div class="spine">
    <div class="cover">
      <button class="cover-hit" onclick={() => openItem(item)} aria-label={item.kind === 'book' ? item.book.title : item.series}>
        {#if item.kind === 'book'}
          {#if item.book.cover_url}
            <img src={item.book.cover_url} alt={item.book.title} />
          {:else}
            <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[item.book.category]}"><span>{item.book.title}</span></div>
          {/if}
        {:else if item.cover_url}
          <img src={item.cover_url} alt={item.series} />
        {:else}
          <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[item.category]}"><span>{item.series}</span></div>
        {/if}
      </button>
      <div class="edge" style="background:{CATEGORY_COLOR[item.kind === 'book' ? item.book.category : item.category]}"></div>
      {#if item.kind === 'series'}
        <div class="count-badge">×{item.count}</div>
      {:else if item.book.status === 'reading'}
        <button class="quick-action" onclick={(e) => markFinished(item.book, e)} title="Marquer comme lu">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path d="M5 13l4 4L19 7" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
          >
        </button>
      {:else if item.book.status === 'wishlist'}
        <button class="quick-action" onclick={(e) => markReading(item.book, e)} title="Commencer la lecture">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="var(--accent-ink)" /></svg>
        </button>
      {:else if item.book.status === 'read'}
        <div class="stamp">
          <span>Lu</span>
          <span>{stampDate(item.book.date_read)}</span>
        </div>
      {/if}
    </div>
    <button class="spine-text" onclick={() => openItem(item)}>
      <div class="spine-title">{item.kind === 'book' ? item.book.title : item.series}</div>
      <div class="spine-sub">{item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}</div>
    </button>
  </div>
{/snippet}

<div class="page">
  <div class="header">
    <span class="eyebrow">{books.length} livre{books.length > 1 ? 's' : ''} dans ta bibliothèque</span>
    <h1 class="page-title">Ma collection</h1>

    <div class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        ><circle cx="11" cy="11" r="7" stroke="var(--ink-faint)" stroke-width="2" /><path
          d="M21 21l-4.3-4.3"
          stroke="var(--ink-faint)"
          stroke-width="2"
          stroke-linecap="round"
        /></svg
      >
      <input placeholder="Rechercher un titre, un auteur…" bind:value={query} />
    </div>

    <div class="cat-row">
      <button class="chip" class:active={filterCategory === 'Toutes'} onclick={() => (filterCategory = 'Toutes')}>Toutes</button>
      {#each categories as c (c)}
        <button class="chip" class:active={filterCategory === c} onclick={() => (filterCategory = c)}>{CATEGORY_LABEL[c]}</button>
      {/each}
    </div>
  </div>

  {#if loading}
    <p class="empty">Chargement…</p>
  {:else if resultsActive}
    <div class="results">
      <div class="results-head">
        <span class="results-count">{resultsDisplay.length} résultat{resultsDisplay.length > 1 ? 's' : ''}</span>
        <div class="view-toggle">
          <button class:active={!resultsAsList} onclick={() => (resultsAsList = false)} aria-label="Vue grille">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              ><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" /><rect
                x="13"
                y="4"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="2"
              /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" /><rect
                x="13"
                y="13"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="2"
              /></svg
            >
          </button>
          <button class:active={resultsAsList} onclick={() => (resultsAsList = true)} aria-label="Vue liste">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              ><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
            >
          </button>
        </div>
      </div>
      {#if resultsDisplay.length === 0}
        <div class="empty">
          <p>Aucun livre ne correspond à cette recherche.</p>
        </div>
      {:else if resultsAsList}
        <div class="list">
          {#each resultsDisplay as item (item.key)}
            <button class="row" onclick={() => openItem(item)}>
              <div class="row-cover">
                {#if item.kind === 'book'}
                  {#if item.book.cover_url}<img src={item.book.cover_url} alt={item.book.title} />{:else}<div
                      class="cover-fallback"
                      style="background:{CATEGORY_GRADIENT[item.book.category]}"
                    ></div>{/if}
                {:else if item.cover_url}
                  <img src={item.cover_url} alt={item.series} />
                {:else}
                  <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[item.category]}"></div>
                {/if}
              </div>
              <div class="row-mid">
                <div class="row-title">{item.kind === 'book' ? item.book.title : item.series}</div>
                <div class="spine-sub">{item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}</div>
              </div>
              <svg width="9" height="15" viewBox="0 0 24 24" fill="none"
                ><path d="M8 4l9 8-9 8" stroke="var(--ink-faint)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
              >
            </button>
          {/each}
        </div>
      {:else}
        <div class="grid">
          {#each resultsDisplay as item (item.key)}
            {@render spineCard(item)}
          {/each}
        </div>
      {/if}
    </div>
  {:else if books.length === 0}
    <div class="empty">
      <p>Ta bibliothèque est vide.</p>
      <button class="cta" onclick={() => currentView.set({ name: 'add' })}>Ajouter ton premier livre</button>
    </div>
  {:else}
    {#each shelves as shelf (shelf.status)}
      {#if shelf.items.length > 0}
        <div class="shelf">
          <div class="shelf-label">{shelf.label} <span>{shelf.items.length}</span></div>
          <div class="shelf-row">
            {#each shelf.items as item (item.key)}
              {@render spineCard(item)}
            {/each}
          </div>
          <div class="shelf-ledge"></div>
        </div>
      {/if}
    {/each}

    {#if seriesGroups.length > 0}
      <div class="incomplete">
        <div class="shelf-label">Séries incomplètes <span>{seriesGroups.length}</span></div>
        <div class="series-blocks">
          {#each seriesGroups as g (g.series)}
            <div class="series-block card">
              <div class="series-block-title">{g.series}</div>
              <div class="tome-chip-row">
                {#each g.missing as n (n)}
                  <button class="tome-chip" onclick={() => currentView.set({ name: 'add', query: `${g.series} Tome ${n}` })}>T{n} manquant</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  <button class="signout-link" onclick={signOut}>Se déconnecter</button>
</div>

<style>
  .page {
    padding: 24px 20px 48px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .header {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 10px;
  }
  .header .page-title {
    margin-top: 2px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 15px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .search input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    color: var(--ink);
    font-size: 13.5px;
  }
  .cat-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }
  .cat-row .chip {
    border: 1px solid var(--line);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    color: var(--ink-faint);
    padding: 3rem 1rem;
    font-size: 0.9rem;
  }
  .empty p {
    margin: 0;
  }
  .cta {
    padding: 12px 22px;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    font-size: 13px;
  }

  .shelf {
    position: relative;
    padding-top: 18px;
  }
  .shelf-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .shelf-label span {
    color: var(--ink-faint);
    font-weight: 600;
  }
  .shelf-row {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 2px 2px 18px;
  }
  .shelf-ledge {
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--line-strong) 15%, var(--line-strong) 85%, transparent);
    margin-bottom: 4px;
    box-shadow: 0 6px 10px -6px rgba(0, 0, 0, 0.5);
  }

  .spine {
    flex-shrink: 0;
    width: 110px;
    display: flex;
    flex-direction: column;
  }
  .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 5px;
    overflow: hidden;
    background: var(--paper-alt);
    box-shadow: var(--shadow-card);
  }
  .cover-hit {
    position: absolute;
    inset: 0;
    border: none;
    background: none;
    padding: 0;
    width: 100%;
    height: 100%;
  }
  .cover-hit img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cover-fallback {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
  }
  .cover-fallback::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.55) 100%);
  }
  .cover-fallback span {
    position: relative;
    z-index: 1;
    padding: 7px;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
  }
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 3px;
  }
  .count-badge {
    position: absolute;
    z-index: 2;
    top: 6px;
    left: 6px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 999px;
    pointer-events: none;
  }
  .stamp {
    position: absolute;
    z-index: 2;
    bottom: 8px;
    right: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
    padding: 3px 6px;
    border: 1.5px solid var(--stamp);
    border-radius: 6px;
    color: #7a2c1f;
    background: #f3efe4;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    transform: rotate(-9deg);
    pointer-events: none;
  }
  .stamp span:first-child {
    font-family: var(--font-mono);
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .stamp span:last-child {
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
  }
  .quick-action {
    position: absolute;
    z-index: 2;
    bottom: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spine-text {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    font: inherit;
    color: inherit;
    width: 100%;
  }
  .spine-title {
    margin-top: 8px;
    font-weight: 700;
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .spine-sub {
    font-size: 11px;
    color: var(--ink-faint);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results {
    padding-top: 6px;
  }
  .results-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .results-count {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-dim);
  }
  .view-toggle {
    display: flex;
    gap: 4px;
  }
  .view-toggle button {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    border: none;
    background: none;
    color: var(--ink-faint);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .view-toggle button.active {
    background: var(--paper-alt);
    color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 18px;
  }
  .grid .spine {
    width: auto;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .row {
    border: none;
    background: none;
    padding: 11px 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: flex;
    gap: 13px;
    align-items: center;
    border-bottom: 1px solid var(--line);
    width: 100%;
    text-align: left;
  }
  .row-cover {
    width: 46px;
    height: 68px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--paper-alt);
  }
  .row-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .row-mid {
    flex: 1;
    min-width: 0;
  }
  .row-title {
    font-weight: 700;
    font-size: 13.5px;
    color: var(--ink);
  }

  .incomplete {
    margin-top: 22px;
    padding-top: 4px;
  }
  .series-blocks {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .series-block {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .series-block-title {
    font-weight: 700;
    font-size: 13.5px;
  }
  .tome-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tome-chip {
    border: 1px dashed var(--line-strong);
    background: none;
    border-radius: 7px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
  }

  .signout-link {
    align-self: center;
    margin-top: 36px;
    border: none;
    background: none;
    color: var(--ink-faint);
    font-size: 12px;
    text-decoration: underline;
  }
</style>
