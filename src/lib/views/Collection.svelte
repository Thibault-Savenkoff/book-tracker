<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_BADGE_CLASS } from '../bookStyle'
  import { parseSeriesVolume } from '../series'
  import { booksStore } from '../booksStore'
  import { searchQuery, filterCategory } from '../collectionFilter'

  let books = $state<Book[]>([])
  let loading = $state(true)

  async function load() {
    loading = true
    const { data } = await supabase.from('books').select('*').order('date_added', { ascending: false })
    books = data ?? []
    loading = false
  }
  load()

  $effect(() => {
    booksStore.set(books)
  })

  const resultsActive = $derived($searchQuery.trim() !== '' || $filterCategory !== 'Toutes')

  const filtered = $derived(
    books.filter(
      (b) =>
        ($filterCategory === 'Toutes' || b.category === $filterCategory) &&
        (!$searchQuery.trim() || `${b.title} ${b.authors.join(' ')}`.toLowerCase().includes($searchQuery.trim().toLowerCase())),
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

  const readingItems = $derived(groupDisplay(books.filter((b) => b.status === 'reading')))
  const allItems = $derived(groupDisplay(books))
  const resultsDisplay = $derived(resultsActive ? groupDisplay(filtered) : [])

  /** Un livre ouvre sa fiche en volet ; une série filtre directement la collection sur son nom. */
  function openItem(item: DisplayItem) {
    if (item.kind === 'book') currentView.set({ name: 'book', id: item.book.id })
    else {
      filterCategory.set('Toutes')
      searchQuery.set(item.series)
    }
  }
</script>

{#snippet coverFallback(title: string)}
  <div class="w-full h-full bg-app-card dark:bg-app-card border border-light-border dark:border-app-border flex flex-col items-center justify-center gap-2 p-3">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="text-slate-500 flex-shrink-0"
      ><path
        d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
    <span class="font-serif text-xs font-semibold text-slate-200 text-center px-1 line-clamp-3">{title}</span>
  </div>
{/snippet}

{#snippet readingCard(item: DisplayItem)}
  {@const title = item.kind === 'book' ? item.book.title : item.series}
  {@const cover = item.kind === 'book' ? item.book.cover_url : item.cover_url}
  {@const category = item.kind === 'book' ? item.book.category : item.category}
  {@const author = item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}
  <div
    role="button"
    tabindex="0"
    onclick={() => openItem(item)}
    onkeydown={(e) => e.key === 'Enter' && openItem(item)}
    class="group p-4 rounded-xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border hover:border-slate-300 dark:hover:border-app-borderHover shadow-sm dark:shadow-none transition cursor-pointer flex gap-4"
  >
    <div class="w-20 h-28 rounded-md overflow-hidden bg-slate-100 dark:bg-app-card flex-shrink-0 cover-shadow group-hover:scale-105 transition-transform duration-300">
      {#if cover}
        <img src={cover} alt={title} class="w-full h-full object-cover" />
      {:else}
        {@render coverFallback(title)}
      {/if}
    </div>
    <div class="flex-1 flex flex-col justify-between min-w-0">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[category]}`}>{CATEGORY_LABEL[category].toUpperCase()}</span>
        </div>
        <h3 class="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{title}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{author}</p>
      </div>
      {#if item.kind === 'book'}
        <div class="flex items-center gap-1.5 text-[10px] font-mono text-amber-600 dark:text-amber-400">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          En cours de lecture
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet bookCard(item: DisplayItem)}
  {@const title = item.kind === 'book' ? item.book.title : item.series}
  {@const cover = item.kind === 'book' ? item.book.cover_url : item.cover_url}
  {@const category = item.kind === 'book' ? item.book.category : item.category}
  {@const author = item.kind === 'book' ? item.book.authors.join(', ') : `${item.count} tomes`}
  <div class="group flex flex-col cursor-pointer">
    <div
      class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border cover-shadow relative mb-2.5 transition duration-200 group-hover:-translate-y-1 group-hover:border-slate-300 dark:group-hover:border-app-borderHover"
    >
      <button class="absolute inset-0 w-full h-full" onclick={() => openItem(item)} aria-label={title}>
        {#if cover}
          <img src={cover} alt={title} class="w-full h-full object-cover" />
        {:else}
          {@render coverFallback(title)}
        {/if}
      </button>

      {#if item.kind === 'series'}
        <span class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/90 dark:bg-black/70 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-light-border dark:border-white/10 pointer-events-none"
          >×{item.count}</span
        >
      {:else if item.book.status === 'read'}
        <span
          class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/90 dark:bg-black/70 backdrop-blur-md text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 pointer-events-none"
        >
          LU
        </span>
      {/if}
    </div>
    <button class="text-left w-full" onclick={() => openItem(item)}>
      <h4 class="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{title}</h4>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{author}</p>
    </button>
  </div>
{/snippet}

<div class="p-4 md:p-8 space-y-8">
  {#if loading}
    <p class="text-center text-slate-400 py-16 text-sm">Chargement…</p>
  {:else if resultsActive}
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-serif text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Résultats</h2>
        <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{resultsDisplay.length} résultat{resultsDisplay.length > 1 ? 's' : ''}</span>
      </div>
      {#if resultsDisplay.length === 0}
        <p class="text-center text-slate-400 py-16 text-sm">Aucun livre ne correspond à cette recherche.</p>
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
    {#if readingItems.length > 0}
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 class="font-serif text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Lectures Actuelles</h2>
          </div>
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{readingItems.length} volume{readingItems.length > 1 ? 's' : ''} en cours</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each readingItems as item (item.key)}
            {@render readingCard(item)}
          {/each}
        </div>
      </div>
    {/if}

    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-serif text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Tous les Ouvrages</h2>
        <span class="text-xs font-mono text-slate-500">{books.length} livre{books.length > 1 ? 's' : ''}</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
        {#each allItems as item (item.key)}
          {@render bookCard(item)}
        {/each}

        <button
          onclick={() => currentView.set({ name: 'add' })}
          class="aspect-[2/3] w-full rounded-xl border border-dashed border-light-border dark:border-app-border hover:border-indigo-500 flex flex-col items-center justify-center cursor-pointer group bg-light-surface/50 dark:bg-app-surface/40 hover:bg-light-surface dark:hover:bg-app-surface transition p-4 text-center"
        >
          <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-600 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-white mb-2 transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
          </div>
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">Scanner / Ajouter</span>
        </button>
      </div>
    </div>

    {#if seriesGroups.length > 0}
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-serif text-2xl font-bold text-slate-900 dark:text-white tracking-wide">Séries incomplètes</h2>
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
</div>
