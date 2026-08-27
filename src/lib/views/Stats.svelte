<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { CATEGORY_LABEL, CATEGORY_COLOR } from '../bookStyle'

  let books = $state<Book[]>([])
  let loading = $state(true)

  async function load() {
    loading = true
    const { data } = await supabase.from('books').select('*')
    books = data ?? []
    loading = false
  }
  load()

  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']

  const readBooks = $derived(books.filter((b) => b.status === 'read'))
  const totalRead = $derived(readBooks.length)
  const totalBooks = $derived(books.length)
  const totalPages = $derived(readBooks.reduce((sum, b) => sum + (b.pages ?? 0), 0))
  const avgRating = $derived(
    readBooks.length ? (readBooks.reduce((s, b) => s + (b.rating ?? 0), 0) / readBooks.length).toFixed(1) : '—',
  )

  const months = $derived(() => {
    const out: { label: string; count: number }[] = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const count = readBooks.filter((b) => b.date_read?.slice(0, 7) === key).length
      out.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), count })
    }
    const max = Math.max(1, ...out.map((m) => m.count))
    return out.map((m) => ({ ...m, pct: m.count ? Math.max(4, Math.round((m.count / max) * 100)) : 0 }))
  })

  const categoryStats = $derived(
    categories
      .map((cat) => ({
        label: CATEGORY_LABEL[cat],
        count: books.filter((b) => b.category === cat).length,
        color: CATEGORY_COLOR[cat],
        sharePct: totalBooks ? (books.filter((b) => b.category === cat).length / totalBooks) * 100 : 0,
      }))
      .filter((c) => c.count > 0),
  )

  const donutConic = $derived(() => {
    let acc = 0
    const parts = categoryStats.map((c) => {
      const start = acc
      acc += c.sharePct
      return `${c.color} ${start}% ${acc}%`
    })
    if (acc < 100) parts.push(`#e2e8f0 ${acc}% 100%`)
    return `conic-gradient(${parts.join(',')})`
  })
</script>

<div class="p-4 md:p-8 space-y-6">
  <div>
    <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Bilan de lecture</span>
    <h1 class="font-serif text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Statistiques</h1>
  </div>

  {#if loading}
    <p class="text-center text-slate-400 py-16 text-sm">Chargement…</p>
  {:else}
    <div class="grid grid-cols-2 gap-3">
      <div
        class="row-span-2 rounded-2xl p-5 flex flex-col justify-between bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/25"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Livres lus</span>
        <div class="font-serif text-5xl font-bold text-slate-900 dark:text-white my-3">{totalRead}</div>
        <span class="text-xs text-slate-400">sur {totalBooks} au total</span>
      </div>
      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <div class="font-serif text-2xl font-bold text-slate-900 dark:text-white">{totalPages}</div>
        <div class="text-[10.5px] text-slate-400 mt-1">Pages lues</div>
      </div>
      <div class="rounded-2xl p-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
        <div class="font-serif text-2xl font-bold text-slate-900 dark:text-white">{avgRating}★</div>
        <div class="text-[10.5px] text-slate-400 mt-1">Note moyenne</div>
      </div>
    </div>

    <div class="rounded-2xl p-5 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border">
      <div class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Lectures par mois</div>
      <div class="flex items-end gap-2 h-24">
        {#each months() as m (m.label)}
          <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div class="w-full rounded-t bg-indigo-500" style="height:{m.pct}%"></div>
            <span class="text-[9.5px] text-slate-400">{m.label}</span>
          </div>
        {/each}
      </div>
    </div>

    {#if categoryStats.length > 0}
      <div class="rounded-2xl p-5 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border flex items-center gap-5">
        <div class="relative w-24 h-24 rounded-full flex-shrink-0" style="background:{donutConic()}">
          <div class="absolute inset-[15px] rounded-full bg-light-surface dark:bg-app-surface flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
            {totalBooks}
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          {#each categoryStats as c (c.label)}
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{c.color}"></span>
              <span class="text-xs text-slate-700 dark:text-slate-200 flex-1">{c.label}</span>
              <span class="text-xs text-slate-400">{c.count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
