<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { CATEGORY_LABEL, CATEGORY_BAR_CLASS, CATEGORY_BADGE_CLASS } from '../bookStyle'
  import { readingGoal } from '../readingGoal'

  let books = $state<Book[]>([])
  let loading = $state(true)
  let loadError = $state(false)
  let editingGoal = $state(false)
  let goalInputEl = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (editingGoal) goalInputEl?.focus()
  })

  async function load() {
    loading = true
    loadError = false
    // Sans ça, une panne réseau affiche un bilan à zéro comme si l'année était vide.
    const { data, error } = await supabase.from('books').select('*')
    if (error) loadError = true
    else books = data ?? []
    loading = false
  }
  load()

  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']
  const now = new Date()
  const year = now.getFullYear()
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  const readBooks = $derived(books.filter((b) => b.status === 'read'))
  const totalBooks = $derived(books.length)
  const readThisYear = $derived(readBooks.filter((b) => b.date_read?.slice(0, 4) === String(year)))
  const readLastYear = $derived(readBooks.filter((b) => b.date_read?.slice(0, 4) === String(year - 1)))
  const totalReadThisYear = $derived(readThisYear.length)
  const yoyDelta = $derived(totalReadThisYear - readLastYear.length)

  const pagesThisYear = $derived(readThisYear.reduce((sum, b) => sum + (b.pages ?? 0), 0))
  const daysElapsedThisYear = $derived(Math.max(1, Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1))
  const avgPagesPerDay = $derived(daysElapsedThisYear ? (pagesThisYear / daysElapsedThisYear).toFixed(1) : '0')

  const goalPct = $derived($readingGoal > 0 ? Math.min(100, Math.round((totalReadThisYear / $readingGoal) * 100)) : 0)
  const goalConic = $derived(`conic-gradient(#6366f1 ${goalPct}%, transparent ${goalPct}%)`)

  const categoryStats = $derived(
    categories
      .map((cat) => ({
        key: cat,
        label: CATEGORY_LABEL[cat],
        count: books.filter((b) => b.category === cat).length,
        sharePct: totalBooks ? (books.filter((b) => b.category === cat).length / totalBooks) * 100 : 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count),
  )

  const dominantCategory = $derived(categoryStats[0] ?? null)

  const months = $derived(
    monthNames.map((label, i) => {
      const count = readBooks.filter((b) => {
        if (!b.date_read) return false
        const [y, m] = b.date_read.split('-')
        return Number(y) === year && Number(m) === i + 1
      }).length
      return { label, count, isCurrent: i === now.getMonth() }
    }),
  )
  const maxMonth = $derived(Math.max(1, ...months.map((m) => m.count)))

  function setGoal(e: Event) {
    const value = Number((e.target as HTMLInputElement).value)
    if (Number.isFinite(value) && value > 0) readingGoal.set(value)
    editingGoal = false
  }
</script>

<div class="p-4 md:p-8 space-y-6">
  <div>
    <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Chronométrie & statistiques</span>
    <h1 class="font-serif text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Bilan de Lecture {year}</h1>
  </div>

  {#if loading}
    <p class="text-center text-slate-400 py-16 text-sm">Chargement…</p>
  {:else if loadError}
    <div class="flex flex-col items-center gap-4 text-center py-16 text-slate-400">
      <p>Impossible de charger ton bilan.</p>
      <button class="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold" onclick={load}>Réessayer</button>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Volumes achevés</span>
        <div class="font-serif text-3xl font-bold text-indigo-500 dark:text-indigo-400 mt-1">{totalReadThisYear}</div>
        <span class="text-[11px] font-mono {yoyDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}">
          {yoyDelta >= 0 ? '+' : ''}{yoyDelta} vs {year - 1}
        </span>
      </div>

      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Pages parcourues</span>
        <div class="font-serif text-3xl font-bold text-slate-900 dark:text-white mt-1">{pagesThisYear}</div>
        <span class="text-[11px] font-mono text-slate-400">{avgPagesPerDay} p./jour</span>
      </div>

      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border flex items-center gap-3">
        <div class="relative w-12 h-12 rounded-full flex-shrink-0" style="background:{goalConic}">
          <div class="absolute inset-[3px] rounded-full bg-light-surface dark:bg-app-surface"></div>
        </div>
        <div class="min-w-0">
          <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Objectif annuel</span>
          {#if editingGoal}
            <input
              bind:this={goalInputEl}
              type="number"
              min="1"
              value={$readingGoal}
              onblur={setGoal}
              onkeydown={(e) => e.key === 'Enter' && setGoal(e)}
              class="w-16 bg-transparent border-b border-indigo-500 outline-none text-sm font-mono text-slate-900 dark:text-white"
            />
          {:else}
            <button class="text-sm font-mono text-slate-900 dark:text-white" onclick={() => (editingGoal = true)}>
              {totalReadThisYear} / {$readingGoal}
            </button>
          {/if}
        </div>
      </div>

      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">Genre dominant</span>
        {#if dominantCategory}
          <div class="mt-1.5">
            <span class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[dominantCategory.key]}`}>{dominantCategory.label.toUpperCase()}</span>
          </div>
          <span class="text-[11px] font-mono text-slate-400 mt-1 block">{dominantCategory.count} ouvrages</span>
        {:else}
          <div class="text-sm text-slate-400 mt-2">—</div>
        {/if}
      </div>
    </div>

    <div class="rounded-2xl p-5 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
      <div class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Rythme mensuel {year}</div>
      <div class="flex items-end gap-1.5 sm:gap-2 h-28">
        {#each months as m (m.label)}
          <div
            class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
            title={`${m.label} ${year} : ${m.count} livre${m.count > 1 ? 's' : ''}`}
          >
            <span class="text-[10px] font-mono text-slate-500 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition">{m.count}</span>
            <div
              class={`w-full rounded-t transition-all ${
                m.isCurrent ? 'bg-indigo-600 shadow-md shadow-indigo-600/30' : 'bg-slate-200 dark:bg-app-card'
              }`}
              style="height:{Math.max(4, Math.round((m.count / maxMonth) * 100))}%"
            ></div>
            <span class={`text-[9.5px] ${m.isCurrent ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-400'}`}>{m.label}</span>
          </div>
        {/each}
      </div>
    </div>

    {#if categoryStats.length > 0}
      <div class="rounded-2xl p-5 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border space-y-3.5">
        <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Répartition par catégorie</div>
        {#each categoryStats as c (c.key)}
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-slate-700 dark:text-slate-200">{c.label}</span>
              <span class="font-mono text-slate-400">{c.count} · {Math.round(c.sharePct)}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-app-card overflow-hidden">
              <div class={`h-full rounded-full ${CATEGORY_BAR_CLASS[c.key]}`} style="width:{c.sharePct}%"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
