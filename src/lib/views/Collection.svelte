<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_GRADIENT, STATUS_LABEL } from '../bookStyle'
  import { parseSeriesVolume } from '../series'

  let books = $state<Book[]>([])
  let loading = $state(true)
  let query = $state('')
  let filterStatus = $state<'Tout' | 'reading' | 'read' | 'wishlist'>('Tout')
  let filterCategory = $state<string>('Toutes')
  let view = $state<'list' | 'grid' | 'series'>('grid')
  let catFilterOpen = $state(false)

  const statuses: { key: 'Tout' | 'reading' | 'read' | 'wishlist'; label: string }[] = [
    { key: 'Tout', label: 'Tout' },
    { key: 'reading', label: 'En cours' },
    { key: 'read', label: 'Lu' },
    { key: 'wishlist', label: 'Envies' },
  ]
  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']

  async function load() {
    loading = true
    const { data } = await supabase.from('books').select('*').order('date_added', { ascending: false })
    books = data ?? []
    loading = false
  }
  load()

  const filtered = $derived(
    books.filter(
      (b) =>
        (filterStatus === 'Tout' || b.status === filterStatus) &&
        (filterCategory === 'Toutes' || b.category === filterCategory) &&
        (!query.trim() || `${b.title} ${b.authors.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())),
    ),
  )
  const reading = $derived(books.filter((b) => b.status === 'reading'))

  /** "One Piece" et "One Piece " (espace/casse en trop selon la façon dont le livre a été
   * ajouté) doivent former une seule série — on regroupe sur une clé normalisée. */
  function normSeries(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  /** Regroupe par série (colonne `books.series`, remplie à l'ajout) et déduit les tomes manquants
   * à partir des numéros trouvés dans le titre : les trous entre le min et le max possédés. */
  const seriesGroups = $derived.by(() => {
    const map = new Map<string, Book[]>()
    for (const b of filtered) {
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
      .sort((a, b) => a.series.localeCompare(b.series))
  })

  /** Un item affiché en liste/grille : un livre seul, ou une série regroupée sous une seule
   * carte — affiche "One Piece · 12 tomes" au lieu de 12 lignes identiques "One Piece Tome N". */
  type DisplayItem =
    | { kind: 'book'; key: string; book: Book }
    | { kind: 'series'; key: string; series: string; count: number; cover_url: string | null; category: string; status: Book['status'] }

  // ponytail: filtered.filter() par série = O(n²), sans conséquence pour une collection perso
  const displayItems = $derived.by(() => {
    const items: DisplayItem[] = []
    const seen = new Set<string>()
    for (const b of filtered) {
      if (!b.series) {
        items.push({ kind: 'book', key: b.id, book: b })
        continue
      }
      const key = normSeries(b.series)
      if (seen.has(key)) continue
      seen.add(key)
      const group = filtered.filter((x) => x.series && normSeries(x.series) === key)
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
  })

  async function markFinished(b: Book) {
    const date_read = new Date().toISOString().slice(0, 10)
    await supabase.from('books').update({ status: 'read', date_read }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, status: 'read', date_read } : x))
  }

  async function markReading(b: Book) {
    await supabase.from('books').update({ status: 'reading' }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, status: 'reading' } : x))
  }

  async function setRating(b: Book, n: number) {
    await supabase.from('books').update({ rating: n }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, rating: n } : x))
  }

  function stars(rating: number | null) {
    return [0, 1, 2, 3, 4].map((i) => i < (rating ?? 0))
  }

  function signOut() {
    if (confirm('Se déconnecter ?')) supabase.auth.signOut()
  }
</script>

<div class="page">
  <div class="header">
    <div class="search-row">
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          ><circle cx="11" cy="11" r="7" stroke="rgba(242,242,245,0.45)" stroke-width="2" /><path
            d="M21 21l-4.3-4.3"
            stroke="rgba(242,242,245,0.45)"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
        <input placeholder="Rechercher dans ma collection" bind:value={query} />
      </div>
      <button class="icon-btn quiet" onclick={signOut} aria-label="Déconnexion">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path d="M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z" stroke="rgba(242, 242, 245,0.5)" stroke-width="1.7" /><path
            d="M19.9 12.9v-1.8l-2.1-.4a5.9 5.9 0 00-.6-1.5l1.2-1.8-1.3-1.3-1.8 1.2a5.9 5.9 0 00-1.5-.6L13.4 4.6h-1.8l-.4 2.1a5.9 5.9 0 00-1.5.6L7.9 6.1 6.6 7.4l1.2 1.8a5.9 5.9 0 00-.6 1.5l-2.1.4v1.8l2.1.4a5.9 5.9 0 00.6 1.5l-1.2 1.8 1.3 1.3 1.8-1.2a5.9 5.9 0 001.5.6l.4 2.1h1.8l.4-2.1a5.9 5.9 0 001.5-.6l1.8 1.2 1.3-1.3-1.2-1.8a5.9 5.9 0 00.6-1.5l2.1-.4z"
            stroke="rgba(242, 242, 245,0.5)"
            stroke-width="1.5"
            stroke-linejoin="round"
          /></svg
        >
      </button>
    </div>

    <div class="tabs">
      {#each statuses as s (s.key)}
        <button class="chip" class:active={filterStatus === s.key} onclick={() => (filterStatus = s.key)}>{s.label}</button>
      {/each}
      <button class="chip cat-toggle" class:active={filterCategory !== 'Toutes'} onclick={() => (catFilterOpen = !catFilterOpen)}>
        {filterCategory === 'Toutes' ? 'Catégorie' : CATEGORY_LABEL[filterCategory]} {catFilterOpen ? '▴' : '▾'}
      </button>
    </div>
    {#if catFilterOpen}
      <div class="tabs cat-tabs">
        <button class="chip" class:active={filterCategory === 'Toutes'} onclick={() => (filterCategory = 'Toutes')}>Toutes</button>
        {#each categories as c (c)}
          <button class="chip" class:active={filterCategory === c} onclick={() => (filterCategory = c)}>{CATEGORY_LABEL[c]}</button>
        {/each}
      </div>
    {/if}

    <div class="stat-row">
      <div class="stat"><span class="num">{books.length}</span><span class="unit">livre{books.length > 1 ? 's' : ''}</span></div>
      <div class="view-toggle">
        <button class:active={view === 'list'} onclick={() => (view = 'list')} aria-label="Vue liste">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            ><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
          >
        </button>
        <button class:active={view === 'grid'} onclick={() => (view = 'grid')} aria-label="Vue grille">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
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
        <button class:active={view === 'series'} onclick={() => (view = 'series')} aria-label="Vue séries">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            ><path d="M4 4.5c2.7-1.3 5.6-1.3 8.5 0v15c-2.9-1.3-5.8-1.3-8.5 0v-15zM20.5 4.5c-2.7-1.3-5.6-1.3-8.5 0v15c2.9-1.3 5.8-1.3 8.5 0v-15z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg
          >
        </button>
      </div>
    </div>
  </div>

  {#if loading}
    <p class="empty">Chargement…</p>
  {:else}
    {#if reading.length > 0 && filterStatus === 'Tout' && !query.trim()}
      <div class="reading-section">
        <div class="section-label">En cours de lecture</div>
        <div class="reading-rail">
          {#each reading as b (b.id)}
            <div class="reading-card">
              <button class="cover-btn" onclick={() => currentView.set({ name: 'book', id: b.id })}>
                {#if b.cover_url}
                  <img src={b.cover_url} alt={b.title} />
                {:else}
                  <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[b.category]}"><span>{b.title}</span></div>
                {/if}
                <div class="spine" style="background:{CATEGORY_COLOR[b.category]}"></div>
              </button>
              <button class="reading-info" onclick={() => currentView.set({ name: 'book', id: b.id })}>
                <div class="title">{b.title}</div>
                <div class="author">{b.authors.join(', ')}</div>
              </button>
              <button class="finish-btn" onclick={() => markFinished(b)} title="Marquer comme lu">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  ><path d="M5 13l4 4L19 7" stroke="var(--accent-ink)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" /></svg
                >
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="collection-section">
      {#if filtered.length === 0}
        <div class="empty">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            ><path
              d="M4 4.5c2.7-1.3 5.6-1.3 8.5 0v15c-2.9-1.3-5.8-1.3-8.5 0v-15zM20.5 4.5c-2.7-1.3-5.6-1.3-8.5 0v15c2.9-1.3 5.8-1.3 8.5 0v-15z"
              stroke="rgba(242,242,245,0.28)"
              stroke-width="1.6"
              stroke-linejoin="round"
            /></svg
          >
          <p>Aucun livre dans cette sélection.</p>
        </div>
      {:else if view === 'list'}
        <div class="list">
          {#each displayItems as item (item.key)}
            {#if item.kind === 'series'}
              <div
                class="row"
                role="button"
                tabindex="0"
                onclick={() => (view = 'series')}
                onkeydown={(e) => e.key === 'Enter' && (view = 'series')}
              >
                <div class="row-cover">
                  {#if item.cover_url}
                    <img src={item.cover_url} alt={item.series} />
                  {:else}
                    <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[item.category]}"><span>{item.series}</span></div>
                  {/if}
                  <div class="spine" style="background:{CATEGORY_COLOR[item.category]}"></div>
                </div>
                <div class="row-mid">
                  <div class="row-title">{item.series}</div>
                  <div class="author">{item.count} tomes</div>
                  <div class="row-meta">
                    <span class="status-pill" class:on={item.status === 'reading'}>{STATUS_LABEL[item.status]}</span>
                  </div>
                </div>
                <svg class="chevron" width="9" height="15" viewBox="0 0 24 24" fill="none"
                  ><path d="M8 4l9 8-9 8" stroke="rgba(242,242,245,0.3)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
                >
              </div>
            {:else}
              {@const b = item.book}
              <div
                class="row"
                role="button"
                tabindex="0"
                onclick={() => currentView.set({ name: 'book', id: b.id })}
                onkeydown={(e) => e.key === 'Enter' && currentView.set({ name: 'book', id: b.id })}
              >
                <div class="row-cover">
                  {#if b.cover_url}
                    <img src={b.cover_url} alt={b.title} />
                  {:else}
                    <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[b.category]}"><span>{b.title}</span></div>
                  {/if}
                  <div class="spine" style="background:{CATEGORY_COLOR[b.category]}"></div>
                </div>
                <div class="row-mid">
                  <div class="row-title">{b.title}</div>
                  <div class="author">{b.authors.join(', ')}</div>
                  <div class="row-meta">
                    <span class="status-pill" class:on={b.status === 'reading'}>{STATUS_LABEL[b.status]}</span>
                    {#if b.status === 'read'}
                      <div class="stars" role="group" aria-label="Note">
                        {#each [1, 2, 3, 4, 5] as n (n)}
                          <button
                            type="button"
                            class="star-btn"
                            onclick={(e) => { e.stopPropagation(); setRating(b, n) }}
                            aria-label="{n} étoile{n > 1 ? 's' : ''}"
                          >
                            <span class:filled={n <= (b.rating ?? 0)}>★</span>
                          </button>
                        {/each}
                      </div>
                    {:else if b.rating}
                      <div class="stars">
                        {#each stars(b.rating) as filled}
                          <span class:filled>★</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
                {#if b.status === 'reading'}
                  <button class="row-finish" onclick={(e) => { e.stopPropagation(); markFinished(b) }} title="Marquer comme lu" aria-label="Marquer comme lu">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      ><path d="M5 13l4 4L19 7" stroke="var(--accent-ink)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" /></svg
                    >
                  </button>
                {:else if b.status === 'wishlist'}
                  <button class="row-finish start" onclick={(e) => { e.stopPropagation(); markReading(b) }} title="Commencer la lecture" aria-label="Commencer la lecture">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="var(--accent-ink)" /></svg>
                  </button>
                {:else}
                  <svg class="chevron" width="9" height="15" viewBox="0 0 24 24" fill="none"
                    ><path d="M8 4l9 8-9 8" stroke="rgba(242,242,245,0.3)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
                  >
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else if view === 'grid'}
        <div class="grid">
          {#each displayItems as item (item.key)}
            {#if item.kind === 'series'}
              <button class="card" onclick={() => (view = 'series')}>
                <div class="cover">
                  {#if item.cover_url}
                    <img src={item.cover_url} alt={item.series} />
                  {:else}
                    <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[item.category]}"><span>{item.series}</span></div>
                  {/if}
                  <div class="spine" style="background:{CATEGORY_COLOR[item.category]}"></div>
                  <div class="badge count">×{item.count}</div>
                  {#if item.status === 'reading'}<div class="dot reading"></div>{:else if item.status === 'wishlist'}<div class="dot wishlist"></div>{/if}
                </div>
                <div class="card-title">{item.series}</div>
                <div class="author">{item.count} tomes</div>
              </button>
            {:else}
              {@const b = item.book}
              <button class="card" onclick={() => currentView.set({ name: 'book', id: b.id })}>
                <div class="cover">
                  {#if b.cover_url}
                    <img src={b.cover_url} alt={b.title} />
                  {:else}
                    <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[b.category]}"><span>{b.title}</span></div>
                  {/if}
                  <div class="spine" style="background:{CATEGORY_COLOR[b.category]}"></div>
                  {#if b.status === 'reading'}<div class="dot reading"></div>{:else if b.status === 'wishlist'}<div class="dot wishlist"></div>{/if}
                </div>
                <div class="card-title">{b.title}</div>
                <div class="author">{b.authors.join(', ')}</div>
              </button>
            {/if}
          {/each}
        </div>
      {:else if seriesGroups.length === 0}
        <div class="empty">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            ><path
              d="M4 4.5c2.7-1.3 5.6-1.3 8.5 0v15c-2.9-1.3-5.8-1.3-8.5 0v-15zM20.5 4.5c-2.7-1.3-5.6-1.3-8.5 0v15c2.9-1.3 5.8-1.3 8.5 0v-15z"
              stroke="rgba(242,242,245,0.28)"
              stroke-width="1.6"
              stroke-linejoin="round"
            /></svg
          >
          <p>Aucune série reconnue. Les livres ajoutés un par un via une recherche simple n'ont pas toujours de série associée.</p>
        </div>
      {:else}
        <div class="series-blocks">
          {#each seriesGroups as g (g.series)}
            <div class="series-block glass">
              <div class="series-block-head">
                <div class="cover mini">
                  {#if g.cover_url}
                    <img src={g.cover_url} alt={g.series} />
                  {:else}
                    <div class="cover-fallback" style="background:{CATEGORY_GRADIENT[g.category]}"></div>
                  {/if}
                </div>
                <div class="series-block-info">
                  <div class="series-block-title">{g.series}</div>
                  <div class="series-block-sub">
                    {g.owned.length} possédé{g.owned.length > 1 ? 's' : ''}{#if g.missing.length}
                      · {g.missing.length} manquant{g.missing.length > 1 ? 's' : ''}{/if}
                  </div>
                </div>
              </div>
              <div class="tome-chip-row">
                {#each g.owned as o (o.book.id)}
                  <button class="tome-chip owned" onclick={() => currentView.set({ name: 'book', id: o.book.id })}>{o.volume ? `T${o.volume}` : '?'}</button>
                {/each}
                {#each g.missing as n (n)}
                  <button class="tome-chip missing" onclick={() => currentView.set({ name: 'add', query: `${g.series} Tome ${n}` })} title="Chercher ce tome"
                    >T{n}</button
                  >
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    padding-bottom: 24px;
  }
  .header {
    padding: 58px 22px 12px;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .icon-btn.quiet {
    background: none;
    border: none;
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 15px;
    border-radius: 999px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
  }
  .search input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    color: var(--text);
    font-size: 13.5px;
  }
  .tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    margin-bottom: 4px;
  }
  .cat-tabs {
    margin-bottom: 10px;
  }
  .cat-tabs .chip {
    font-size: 11px;
    padding: 6px 13px;
  }
  .cat-toggle {
    font-size: 11px;
    padding: 6px 13px;
    color: var(--text-faint);
    border: 1px solid var(--glass-border);
  }
  .cat-toggle.active {
    color: var(--accent);
    border-color: var(--accent);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    opacity: 0.55;
    padding: 2.5rem 1rem;
    font-size: 0.9rem;
  }
  .empty p {
    margin: 0;
  }
  .section-label {
    padding: 0 22px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-faint);
    text-transform: uppercase;
  }
  .reading-section {
    padding: 6px 0 8px;
  }
  .reading-rail {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 2px 22px 6px;
  }
  .reading-card {
    flex-shrink: 0;
    width: 210px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
  }
  .cover-btn {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    position: relative;
    width: 48px;
    height: 70px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--bg-alt);
  }
  .cover-btn img,
  .row-cover img {
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
    background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.6) 100%);
  }
  .cover-fallback span {
    position: relative;
    z-index: 1;
    padding: 6px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    color: rgba(255, 255, 255, 0.92);
  }
  .spine {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 3px;
  }
  .reading-info {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    flex: 1;
  }
  .reading-info .title,
  .row-title,
  .card-title {
    font-weight: 700;
    font-size: 13.5px;
    line-height: 1.28;
    color: var(--text);
  }
  .reading-info .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-title {
    margin-top: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .author {
    font-size: 11.5px;
    color: var(--text-faint);
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .finish-btn {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .collection-section {
    padding-top: 6px;
  }
  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0 2px;
  }
  .stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .stat .num {
    font-family: var(--font-display);
    font-size: 27px;
    font-weight: 700;
  }
  .stat .unit {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .view-toggle {
    display: flex;
    gap: 4px;
  }
  .view-toggle button {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: none;
    background: none;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .view-toggle button.active {
    background: var(--glass-bg);
    color: var(--text);
  }
  .list {
    display: flex;
    flex-direction: column;
    padding: 4px 22px 8px;
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
    border-bottom: 1px solid var(--glass-border);
    width: 100%;
    text-align: left;
  }
  .row-cover {
    position: relative;
    width: 50px;
    height: 74px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--bg-alt);
  }
  .row-cover .spine {
    width: 3px;
  }
  .row-mid {
    flex: 1;
    min-width: 0;
  }
  .row-title {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .status-pill {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-faint);
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .status-pill.on {
    color: var(--accent);
    border-color: var(--accent);
  }
  .chevron {
    flex-shrink: 0;
  }
  .row-finish {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .star-btn {
    background: none;
    border: none;
    padding: 2px;
    line-height: 1;
  }
  .stars {
    display: flex;
    gap: 1px;
  }
  .stars span {
    color: rgba(242, 242, 245, 0.18);
    font-size: 10px;
  }
  .stars span.filled {
    color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
    gap: 7px;
    padding: 6px 14px 8px;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 18px;
      padding: 6px 0 8px;
    }
  }
  .card {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    text-align: left;
    font: inherit;
    color: inherit;
  }
  .card .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-alt);
  }
  .card .card-title {
    font-size: 11.5px;
    margin-top: 6px;
  }
  .card .author {
    font-size: 10px;
  }
  .badge {
    position: absolute;
    top: 5px;
    right: 5px;
    background: rgba(13, 13, 15, 0.82);
    color: var(--accent);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 3px 7px;
    border-radius: 999px;
    border: 1px solid var(--accent);
  }
  .badge.count {
    right: auto;
    left: 5px;
    background: rgba(13, 13, 15, 0.82);
    color: var(--text);
    border-color: var(--glass-border);
  }
  .dot {
    position: absolute;
    top: 5px;
    right: 5px;
    z-index: 1;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .dot.reading {
    background: var(--accent);
    box-shadow: 0 0 0 3px rgba(240, 73, 45, 0.25);
  }
  .dot.wishlist {
    background: none;
    border: 1.4px solid rgba(242, 242, 245, 0.55);
  }
  .series-blocks {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 22px 8px;
  }
  .series-block {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .series-block-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cover.mini {
    width: 38px;
    height: 56px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--bg-alt);
  }
  .cover.mini img,
  .cover.mini .cover-fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .series-block-info {
    min-width: 0;
  }
  .series-block-title {
    font-weight: 700;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .series-block-sub {
    font-size: 11.5px;
    color: var(--text-faint);
    margin-top: 2px;
  }
  .tome-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .tome-chip {
    border: none;
    border-radius: 7px;
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 700;
  }
  .tome-chip.owned {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .tome-chip.missing {
    background: none;
    border: 1px dashed var(--glass-border);
    color: var(--text-faint);
  }
</style>
