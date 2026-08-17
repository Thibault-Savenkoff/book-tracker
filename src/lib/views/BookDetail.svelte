<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_GRADIENT, categoryBg, STATUS_LABEL } from '../bookStyle'

  let { id }: { id: string } = $props()

  let book = $state<Book | null>(null)
  let saving = $state(false)

  async function load() {
    const { data } = await supabase.from('books').select('*').eq('id', id).single()
    book = data
  }
  load()

  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']
  const statuses: Book['status'][] = ['reading', 'read', 'wishlist']

  async function save() {
    if (!book) return
    saving = true
    await supabase
      .from('books')
      .update({
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        series: book.series,
        category: book.category,
        status: book.status,
        is_collector_edition: book.is_collector_edition,
        rating: book.rating,
        review: book.review,
        date_read: book.status === 'read' ? (book.date_read ?? new Date().toISOString().slice(0, 10)) : book.date_read,
      })
      .eq('id', book.id)
    saving = false
    currentView.set({ name: 'collection' })
  }

  async function remove() {
    if (!book || !confirm(`Supprimer "${book.title}" ?`)) return
    await supabase.from('books').delete().eq('id', book.id)
    currentView.set({ name: 'collection' })
  }
</script>

{#if book}
  <div class="page">
    <div class="hero" style="background:{CATEGORY_GRADIENT[book.category]}">
      <div class="hero-glow" style="background:radial-gradient(120% 80% at 50% -10%, {categoryBg(book.category)}, transparent 65%)"></div>
      <div class="hero-shade"></div>
      <button class="back" onclick={() => currentView.set({ name: 'collection' })} aria-label="Retour">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          ><path d="M15 5l-7 7 7 7" stroke="#f2f2f5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </button>
      <div class="cover">
        {#if book.cover_url}<img src={book.cover_url} alt={book.title} />{/if}
        <div class="accent-bar" style="background:{CATEGORY_COLOR[book.category]}"></div>
      </div>
    </div>

    <div class="body">
      <div class="titles">
        <div class="btitle">{book.title || 'Sans titre'}</div>
        <div class="bauthor">{book.authors.join(', ') || 'Auteur inconnu'}</div>
      </div>

      <div class="segmented glass">
        {#each statuses as s (s)}
          <button class:active={book.status === s} onclick={() => book && (book.status = s)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>

      <div class="fields glass">
        <label>
          <span>Titre</span>
          <input bind:value={book.title} />
        </label>
        <label>
          <span>Auteur(s)</span>
          <input
            value={book.authors.join(', ')}
            oninput={(e) => (book!.authors = (e.target as HTMLInputElement).value.split(',').map((a) => a.trim()).filter(Boolean))}
          />
        </label>
        <div class="two">
          <label>
            <span>Éditeur</span>
            <input bind:value={book.publisher} />
          </label>
          <label>
            <span>Série</span>
            <input bind:value={book.series} />
          </label>
        </div>
        <label class="checkbox">
          <input type="checkbox" bind:checked={book.is_collector_edition} /> Édition collector
        </label>
      </div>

      <div class="cat-block">
        <span class="field-label">Catégorie</span>
        <div class="cat-chips">
          {#each categories as c (c)}
            <button
              class="cat-chip"
              class:active={book.category === c}
              style={book.category === c ? `border-color:${CATEGORY_COLOR[c]};background:${categoryBg(c)};color:${CATEGORY_COLOR[c]}` : ''}
              onclick={() => book && (book.category = c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          {/each}
        </div>
      </div>

      <div class="rating-block glass">
        <span class="field-label">Ta note</span>
        <div class="stars">
          {#each [1, 2, 3, 4, 5] as n}
            <button type="button" class="star" onclick={() => (book!.rating = book!.rating === n ? null : n)}>
              {(book.rating ?? 0) >= n ? '★' : '☆'}
            </button>
          {/each}
        </div>
      </div>

      <label class="review-label">
        <span class="field-label">Avis</span>
        <textarea rows="5" bind:value={book.review} placeholder="Qu'as-tu pensé de ce livre ?"></textarea>
      </label>

      <div class="actions">
        <button class="delete" onclick={remove}>Supprimer</button>
        <button class="save" onclick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
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
  .hero {
    position: relative;
    height: 220px;
    overflow: hidden;
  }
  .hero-glow {
    position: absolute;
    inset: 0;
  }
  .hero-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(10, 10, 13, 0.15), var(--bg) 96%);
  }
  .back {
    position: absolute;
    top: 58px;
    left: 22px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(10, 10, 13, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  .hero .cover {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -46px;
    margin: 0 auto;
    z-index: 2;
    width: 126px;
    aspect-ratio: 2 / 3;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .hero .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 66px 22px 40px;
  }
  .titles {
    text-align: center;
  }
  .btitle {
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 19px;
  }
  .bauthor {
    font-size: 13px;
    color: var(--text-dim);
    margin-top: 3px;
  }
  .segmented,
  .cat-chips {
    display: flex;
  }
  .segmented {
    padding: 4px;
    gap: 2px;
  }
  .segmented button {
    flex: 1;
    padding: 9px 4px;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: rgba(242, 242, 245, 0.55);
    font-size: 11.5px;
    font-weight: 700;
  }
  .segmented button.active {
    background: var(--text);
    color: var(--bg);
  }
  .fields {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .fields label,
  .review-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label,
  .fields label span {
    font-size: 11px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .fields input {
    padding: 11px 0;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: var(--text);
    font-size: 14.5px;
    outline: none;
  }
  .two {
    display: flex;
    gap: 14px;
  }
  .two label {
    flex: 1;
  }
  .checkbox {
    flex-direction: row !important;
    align-items: center;
    gap: 8px !important;
    font-size: 13px;
    color: var(--text-dim);
  }
  .cat-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cat-chips {
    gap: 8px;
    flex-wrap: wrap;
  }
  .cat-chip {
    padding: 8px 15px;
    border-radius: 20px;
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-dim);
    font-size: 12.5px;
  }
  .cat-chip.active {
    font-weight: 700;
  }
  .rating-block {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .stars {
    display: flex;
    gap: 8px;
  }
  .star {
    background: none;
    border: none;
    font-size: 28px;
    color: var(--text);
    padding: 0;
    line-height: 1;
  }
  .review-label textarea {
    padding: 14px 15px;
    border-radius: 18px;
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .actions button {
    flex: 1;
    padding: 14px;
    border-radius: 18px;
    border: none;
    font-size: 14px;
  }
  .save {
    flex: 1.4;
    background: var(--text);
    color: var(--bg);
    font-weight: 700;
  }
  .delete {
    border: 1px solid rgba(226, 88, 79, 0.35);
    background: rgba(226, 88, 79, 0.06);
    color: var(--danger);
    font-weight: 600;
  }
</style>
