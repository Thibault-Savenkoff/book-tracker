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
    if (acc < 100) parts.push(`var(--line) ${acc}% 100%`)
    return `conic-gradient(${parts.join(',')})`
  })
</script>

<div class="page">
  <div class="header">
    <span class="eyebrow">Bilan de lecture</span>
    <h1 class="page-title">Statistiques</h1>
  </div>

  {#if loading}
    <p class="empty">Chargement…</p>
  {:else}
    <div class="tiles">
      <div class="tile big">
        <span class="label">Livres lus</span>
        <div class="value">{totalRead}</div>
        <span class="sub">sur {totalBooks} au total</span>
      </div>
      <div class="tile card">
        <div class="value small">{totalPages}</div>
        <div class="label small">Pages lues</div>
      </div>
      <div class="tile card">
        <div class="value small">{avgRating}★</div>
        <div class="label small">Note moyenne</div>
      </div>
    </div>

    <div class="panel card">
      <div class="panel-title">Lectures par mois</div>
      <div class="bars">
        {#each months() as m (m.label)}
          <div class="bar-col">
            <div class="bar" style="height:{m.pct}%"></div>
            <span>{m.label}</span>
          </div>
        {/each}
      </div>
    </div>

    {#if categoryStats.length > 0}
      <div class="panel card donut-panel">
        <div class="donut" style="background:{donutConic()}">
          <div class="donut-hole">{totalBooks}</div>
        </div>
        <div class="legend">
          {#each categoryStats as c (c.label)}
            <div class="legend-row">
              <span class="dot" style="background:{c.color}"></span>
              <span class="legend-label">{c.label}</span>
              <span class="legend-count">{c.count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    padding-bottom: 24px;
  }
  .header {
    padding: 24px 20px 16px;
  }
  .header .page-title {
    margin-top: 4px;
  }
  .empty {
    text-align: center;
    color: var(--ink-faint);
    padding: 2rem 1rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    grid-template-rows: auto auto;
    gap: 12px;
    padding: 8px 22px 18px;
  }
  .tile.big {
    grid-column: 1;
    grid-row: 1 / span 2;
    background: linear-gradient(160deg, var(--accent-tint), transparent);
    border: 1px solid rgba(201, 164, 76, 0.28);
    border-radius: 22px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .tile.big .value {
    font-family: var(--font-display);
    font-size: 52px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
    margin: 14px 0;
  }
  .tile.big .label {
    font-size: 11px;
    color: var(--accent-strong);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }
  .tile.big .sub {
    font-size: 11.5px;
    color: var(--ink-faint);
  }
  .tile:not(.big) {
    padding: 14px 16px;
  }
  .value.small {
    font-family: var(--font-display);
    font-size: 23px;
    font-weight: 700;
    color: var(--ink);
  }
  .label.small {
    font-size: 10.5px;
    color: var(--ink-faint);
    margin-top: 3px;
  }
  .panel {
    margin: 0 22px 18px;
    padding: 20px;
  }
  .panel-title {
    font-size: 13px;
    color: var(--ink-dim);
    margin-bottom: 16px;
    font-weight: 600;
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 100px;
  }
  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar {
    width: 100%;
    border-radius: 5px 5px 0 0;
    background: var(--accent);
  }
  .bar-col span {
    font-size: 9.5px;
    color: var(--ink-faint);
  }
  .donut-panel {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .donut {
    position: relative;
    width: 96px;
    height: 96px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .donut-hole {
    position: absolute;
    inset: 15px;
    border-radius: 50%;
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--ink-dim);
    font-weight: 700;
  }
  .legend {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-label {
    font-size: 12.5px;
    color: var(--ink);
    flex: 1;
  }
  .legend-count {
    font-size: 12px;
    color: var(--ink-faint);
  }
</style>
