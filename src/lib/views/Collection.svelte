<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_GRADIENT, CATEGORY_BADGE_CLASS, CATEGORY_DOT_CLASS, STATUS_LABEL } from '../bookStyle'
  import { parseSeriesVolume } from '../series'

  let books = $state<Book[]>([])
  let loading = $state(true)
  let query = $state('')
  let filterCategory = $state<string>('Toutes')
  let resultsAsList = $state(false)
  let quickView = $state<Book | null>(null)
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

  /** Un livre ouvre le volet d'aperçu rapide ; une série filtre directement la collection sur son nom. */
  function openItem(item: DisplayItem) {
    if (item.kind === 'book') quickView = item.book
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
    if (quickView?.id === b.id) quickView = { ...quickView, status: 'read', date_read }
  }

  async function markReading(b: Book, e: Event) {
    e.stopPropagation()
    await supabase.from('books').update({ status: 'reading' }).eq('id', b.id)
    books = books.map((x) => (x.id === b.id ? { ...x, status: 'reading' } : x))
    if (quickView?.id === b.id) quickView = { ...quickView, status: 'reading' }
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

  function chipClass(active: boolean) {
    return active
      ? 'px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-indigo-600 text-white'
      : 'px-3 py-1.5 rounded-lg text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:text-slate-900 dark:hover:text-white'
  }
</script>

{#snippet bookCard(item: DisplayItem)}
  <div class="group flex flex-col cursor-pointer w-full">
    <div
      class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cover-shadow relative mb-2.5 transition duration-200 group-hover:-translate-y-1"
    >
      <button class="absolute inset-0 w-full h-full" onclick={() => openItem(item)} aria-label={item.kind === 'book' ? item.book.title : item.series}>
        {#if item.kind === 'book'}
          {#if item.book.cover_url}
            <img src={item.book.cover_url} alt={item.book.title} class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full flex items-end p-2" style="background:{CATEGORY_GRADIENT[item.book.category]}">
              <span class="relative z-10 text-[11px] font-semibold leading-tight text-white">{item.book.title}</span>
            </div>
          {/if}
        {:else if item.cover_url}
          <img src={item.cover_url} alt={item.series} class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full flex items-end p-2" style="background:{CATEGORY_GRADIENT[item.category]}">
            <span class="relative z-10 text-[11px] font-semibold leading-tight text-white">{item.series}</span>
          </div>
        {/if}
      </button>

      {#if item.kind === 'series'}
        <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 text-white pointer-events-none">×{item.count}</span>
      {:else if item.book.status === 'reading'}
        <button
          class="absolute z-10 bottom-2 right-2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md"
          onclick={(e) => markFinished(item.book, e)}
          title="Marquer comme lu"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {:else if item.book.status === 'wishlist'}
        <button
          class="absolute z-10 bottom-2 right-2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md"
          onclick={(e) => markReading(item.book, e)}
          title="Commencer la lecture"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="currentColor" /></svg>
        </button>
      {:else if item.book.status === 'read'}
        <span
          class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/90 dark:bg-black/70 backdrop-blur-md text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 pointer-events-none"
        >
          LU · {stampDate(item.book.date_read)}
        </span>
      {/if}
    </div>
    <button class="text-left w-full" onclick={() => openItem(item)}>
      <h4 class="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
        {item.kind === 'book' ? item.book.title : item.series}
      </h4>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}
      </p>
    </button>
  </div>
{/snippet}

<div class="p-4 md:p-8 space-y-8">
  <div class="flex flex-col gap-4">
    <div>
      <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500"
        >{books.length} livre{books.length > 1 ? 's' : ''} dans ta bibliothèque</span
      >
      <h1 class="font-serif text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Ma collection</h1>
    </div>

    <div class="relative max-w-md">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        ><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
      >
      <input
        placeholder="Rechercher un titre, un auteur…"
        bind:value={query}
        class="w-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none transition"
      />
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1">
      <button class={chipClass(filterCategory === 'Toutes')} onclick={() => (filterCategory = 'Toutes')}>Toutes</button>
      {#each categories as c (c)}
        <button class={chipClass(filterCategory === c)} onclick={() => (filterCategory = c)}>{CATEGORY_LABEL[c]}</button>
      {/each}
    </div>
  </div>

  {#if loading}
    <p class="text-center text-slate-400 py-16 text-sm">Chargement…</p>
  {:else if resultsActive}
    <div>
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">{resultsDisplay.length} résultat{resultsDisplay.length > 1 ? 's' : ''}</span>
        <div class="flex gap-1">
          <button
            class={`w-8 h-8 rounded-lg flex items-center justify-center ${!resultsAsList ? 'bg-slate-100 dark:bg-white/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
            onclick={() => (resultsAsList = false)}
            aria-label="Vue grille"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              ><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" /><rect
                x="4"
                y="13"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="2"
              /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" /></svg
            >
          </button>
          <button
            class={`w-8 h-8 rounded-lg flex items-center justify-center ${resultsAsList ? 'bg-slate-100 dark:bg-white/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
            onclick={() => (resultsAsList = true)}
            aria-label="Vue liste"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </div>
      </div>
      {#if resultsDisplay.length === 0}
        <p class="text-center text-slate-400 py-16 text-sm">Aucun livre ne correspond à cette recherche.</p>
      {:else if resultsAsList}
        <div class="flex flex-col divide-y divide-light-border dark:divide-app-border">
          {#each resultsDisplay as item (item.key)}
            <button class="flex items-center gap-3 py-3 text-left" onclick={() => openItem(item)}>
              <div class="w-11 h-16 rounded-md overflow-hidden bg-light-card dark:bg-app-card flex-shrink-0">
                {#if item.kind === 'book'}
                  {#if item.book.cover_url}<img src={item.book.cover_url} alt={item.book.title} class="w-full h-full object-cover" />{:else}<div
                      class="w-full h-full"
                      style="background:{CATEGORY_GRADIENT[item.book.category]}"
                    ></div>{/if}
                {:else if item.cover_url}
                  <img src={item.cover_url} alt={item.series} class="w-full h-full object-cover" />
                {:else}
                  <div class="w-full h-full" style="background:{CATEGORY_GRADIENT[item.category]}"></div>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.kind === 'book' ? item.book.title : item.series}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}</div>
              </div>
              <svg width="9" height="15" viewBox="0 0 24 24" fill="none" class="text-slate-400 flex-shrink-0"
                ><path d="M8 4l9 8-9 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
              >
            </button>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
          {#each resultsDisplay as item (item.key)}
            {@render bookCard(item)}
          {/each}
        </div>
      {/if}
    </div>
  {:else if books.length === 0}
    <div class="flex flex-col items-center gap-4 text-center py-16 text-slate-400">
      <p>Ta bibliothèque est vide.</p>
      <button class="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold" onclick={() => currentView.set({ name: 'add' })}
        >Ajouter ton premier livre</button
      >
    </div>
  {:else}
    <div class="space-y-8">
      {#each shelves as shelf (shelf.status)}
        {#if shelf.items.length > 0}
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                {#if shelf.status === 'reading'}<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>{/if}
                <h2 class="font-serif text-xl font-bold text-slate-900 dark:text-white">{shelf.label}</h2>
              </div>
              <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{shelf.items.length}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
              {#each shelf.items as item (item.key)}
                {@render bookCard(item)}
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    {#if seriesGroups.length > 0}
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-serif text-xl font-bold text-slate-900 dark:text-white">Séries incomplètes</h2>
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{seriesGroups.length}</span>
        </div>
        <div class="flex flex-col gap-3">
          {#each seriesGroups as g (g.series)}
            <div class="p-4 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border flex flex-col gap-2">
              <div class="text-sm font-semibold text-slate-900 dark:text-white">{g.series}</div>
              <div class="flex flex-wrap gap-2">
                {#each g.missing as n (n)}
                  <button
                    class="px-3 py-1.5 rounded-lg border border-dashed border-light-border dark:border-app-border text-xs font-mono text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    onclick={() => currentView.set({ name: 'add', query: `${g.series} Tome ${n}` })}
                  >
                    T{n} manquant
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  <button class="block mx-auto mt-6 text-xs text-slate-400 dark:text-slate-500 underline" onclick={signOut}>Se déconnecter</button>
</div>

{#if quickView}
  {@const b = quickView}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-20"
    role="presentation"
    onclick={() => (quickView = null)}
  ></div>
  <aside class="fixed inset-y-0 right-0 w-full sm:w-96 bg-light-surface dark:bg-app-surface border-l border-light-border dark:border-app-border shadow-2xl z-30 flex flex-col">
    <div class="h-16 px-6 border-b border-light-border dark:border-app-border flex items-center justify-between flex-shrink-0">
      <span class="text-xs font-mono text-slate-500 uppercase tracking-wider">Aperçu rapide</span>
      <button class="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white" onclick={() => (quickView = null)} aria-label="Fermer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-6">
      <div class="flex flex-col items-center text-center">
        <div class="w-32 aspect-[2/3] rounded-lg overflow-hidden cover-shadow border border-light-border dark:border-app-border mb-4 bg-light-card dark:bg-app-card">
          {#if b.cover_url}
            <img src={b.cover_url} alt={b.title} class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full" style="background:{CATEGORY_GRADIENT[b.category]}"></div>
          {/if}
        </div>
        <span class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border mb-1 ${CATEGORY_BADGE_CLASS[b.category]}`}>{CATEGORY_LABEL[b.category].toUpperCase()}</span>
        <h3 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">{b.title}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">{b.authors.join(', ')}</p>
      </div>

      <div class="p-4 rounded-xl bg-light-card dark:bg-app-card border border-light-border dark:border-app-border flex items-center justify-between text-xs font-mono">
        <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span class={`w-2 h-2 rounded-full ${CATEGORY_DOT_CLASS[b.category]}`}></span>
          {STATUS_LABEL[b.status]}
        </span>
        {#if b.status === 'read' && b.date_read}
          <span class="text-slate-900 dark:text-white font-semibold">Lu le {stampDate(b.date_read)}</span>
        {/if}
      </div>

      <div class="space-y-2">
        <button
          class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
          onclick={() => currentView.set({ name: 'book', id: b.id })}
        >
          Ouvrir la fiche complète
        </button>
        {#if b.status === 'reading'}
          <button
            class="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-medium border border-light-border dark:border-app-border transition"
            onclick={(e) => markFinished(b, e)}
          >
            Marquer comme terminé
          </button>
        {:else if b.status === 'wishlist'}
          <button
            class="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-medium border border-light-border dark:border-app-border transition"
            onclick={(e) => markReading(b, e)}
          >
            Commencer la lecture
          </button>
        {/if}
      </div>
    </div>
  </aside>
{/if}
