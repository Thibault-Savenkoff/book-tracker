<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_GRADIENT, categoryBg, STATUS_LABEL } from '../bookStyle'
  import { searchCoverCandidates } from '../bookLookup'

  let { id }: { id: string } = $props()

  let book = $state<Book | null>(null)
  let saving = $state(false)
  let coverPickerOpen = $state(false)
  let coverLoading = $state(false)
  let coverCandidates = $state<string[]>([])

  // ponytail: un seul résultat (le cas courant) = on l'applique direct, pas de modale à un choix.
  // Plusieurs résultats = vraies jaquettes alternatives, on laisse choisir pour ne pas se tromper.
  async function openCoverPicker() {
    if (!book) return
    coverLoading = true
    const results = await searchCoverCandidates(`${book.title} ${book.authors.join(' ')}`, book.isbn)
    coverLoading = false
    if (results.length <= 1) {
      if (results[0]) book.cover_url = results[0]
      return
    }
    coverCandidates = results
    coverPickerOpen = true
  }

  function pickCover(url: string) {
    if (!book) return
    book.cover_url = url
    coverPickerOpen = false
  }

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
        cover_url: book.cover_url,
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
          ><path d="M15 5l-7 7 7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </button>
      <div class="cover">
        {#if book.cover_url}<img src={book.cover_url} alt={book.title} />{/if}
        <div class="accent-bar" style="background:{CATEGORY_COLOR[book.category]}"></div>
      </div>
    </div>

    {#if coverPickerOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="cover-picker-backdrop"
        onclick={() => (coverPickerOpen = false)}
        onkeydown={(e) => e.key === 'Escape' && (coverPickerOpen = false)}
      >
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="cover-picker card" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
          <div class="cover-picker-head">
            <span>Choisir une couverture</span>
            <button onclick={() => (coverPickerOpen = false)} aria-label="Fermer">✕</button>
          </div>
          {#if coverLoading}
            <p class="cover-picker-empty">Recherche…</p>
          {:else if coverCandidates.length === 0}
            <p class="cover-picker-empty">Aucune autre couverture trouvée.</p>
          {:else}
            <div class="cover-picker-grid">
              {#each coverCandidates as url (url)}
                <button class="cover-option" class:active={url === book.cover_url} onclick={() => pickCover(url)}>
                  <img src={url} alt="Option de couverture" loading="lazy" />
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="body">
      <div class="titles">
        <div class="btitle">{book.title || 'Sans titre'}</div>
        <div class="bauthor">{book.authors.join(', ') || 'Auteur inconnu'}</div>
        <button class="change-cover-link" onclick={openCoverPicker} disabled={coverLoading}>
          {coverLoading ? 'Recherche…' : 'Améliorer la qualité de la couverture'}
        </button>
      </div>

      <div class="segmented card">
        {#each statuses as s (s)}
          <button class:active={book.status === s} onclick={() => book && (book.status = s)}>{STATUS_LABEL[s]}</button>
        {/each}
      </div>

      <div class="fields card">
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

      <div class="rating-block card">
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
  }
  .hero-glow {
    position: absolute;
    inset: 0;
  }
  .hero-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15), var(--paper) 96%);
  }
  .back {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(20, 12, 5, 0.35);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  .hero .cover {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -52px;
    margin: 0 auto;
    z-index: 2;
    width: 160px;
    aspect-ratio: 2 / 3;
    border-radius: 14px;
    overflow: hidden;
    background: var(--paper-alt);
    box-shadow: 0 20px 40px rgba(20, 12, 5, 0.35);
    border: 3px solid var(--paper);
    padding: 5px;
  }
  .hero .cover img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
  }
  .accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
  }
  .change-cover-link {
    margin-top: 10px;
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: underline;
  }
  .cover-picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .cover-picker-backdrop {
      align-items: center;
    }
  }
  .cover-picker {
    width: 100%;
    max-width: 460px;
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    border-radius: 20px 20px 0 0;
    padding: 16px;
    gap: 14px;
  }
  @media (min-width: 640px) {
    .cover-picker {
      border-radius: 20px;
    }
  }
  .cover-picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
  }
  .cover-picker-head button {
    border: none;
    background: none;
    color: var(--ink-faint);
    font-size: 16px;
    padding: 4px;
  }
  .cover-picker-empty {
    color: var(--ink-faint);
    font-size: 13px;
    text-align: center;
    padding: 20px 0;
  }
  .cover-picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    overflow-y: auto;
    padding-bottom: 2px;
  }
  .cover-option {
    aspect-ratio: 2 / 3;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    background: var(--surface);
  }
  .cover-option.active {
    border-color: var(--accent);
  }
  .cover-option img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 72px 22px 40px;
  }
  .titles {
    text-align: center;
  }
  .btitle {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    color: var(--ink);
  }
  .bauthor {
    font-size: 13px;
    color: var(--ink-dim);
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
    border-radius: 11px;
    border: none;
    background: transparent;
    color: var(--ink-dim);
    font-size: 11.5px;
    font-weight: 700;
  }
  .segmented button.active {
    background: var(--ink);
    color: var(--paper);
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
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .fields input {
    padding: 11px 0;
    border: none;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    font-size: 14.5px;
    outline: none;
  }
  .fields input:focus {
    border-bottom-color: var(--accent);
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
    color: var(--ink-dim);
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
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-dim);
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
    color: var(--accent);
    padding: 0;
    line-height: 1;
  }
  .review-label textarea {
    padding: 14px 15px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
  }
  .review-label textarea:focus {
    border-color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .actions button {
    flex: 1;
    padding: 14px;
    border-radius: 16px;
    border: none;
    font-size: 14px;
  }
  .save {
    flex: 1.4;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
  .delete {
    border: 1px solid rgba(193, 84, 63, 0.35);
    background: rgba(193, 84, 63, 0.1);
    color: var(--danger);
    font-weight: 600;
  }
</style>
