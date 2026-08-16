<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'

  let { id }: { id: string } = $props()

  let book = $state<Book | null>(null)
  let saving = $state(false)

  async function load() {
    const { data } = await supabase.from('books').select('*').eq('id', id).single()
    book = data
  }
  load()

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
        is_collector_edition: book.is_collector_edition,
        rating: book.rating,
        review: book.review,
      })
      .eq('id', book.id)
    saving = false
  }

  async function remove() {
    if (!book || !confirm(`Supprimer "${book.title}" ?`)) return
    await supabase.from('books').delete().eq('id', book.id)
    currentView.set({ name: 'library' })
  }
</script>

<div class="header">
  <button onclick={() => currentView.set({ name: 'library' })}>← Retour</button>
</div>

{#if book}
  <div class="detail">
    {#if book.cover_url}<img class="cover" src={book.cover_url} alt={book.title} />{/if}

    <label>Titre <input bind:value={book.title} /></label>
    <label>Auteur(s)
      <input
        value={book.authors.join(', ')}
        oninput={(e) => (book!.authors = (e.target as HTMLInputElement).value.split(',').map((a) => a.trim()).filter(Boolean))}
      />
    </label>
    <label>Éditeur <input bind:value={book.publisher} /></label>
    <label>Série <input bind:value={book.series} /></label>
    <label>Catégorie
      <select bind:value={book.category}>
        <option value="roman">Roman</option>
        <option value="bd">BD</option>
        <option value="manga">Manga</option>
        <option value="comics">Comics</option>
        <option value="autre">Autre</option>
      </select>
    </label>
    <label class="checkbox"><input type="checkbox" bind:checked={book.is_collector_edition} /> Édition collector</label>

    <label>Note
      <div class="stars">
        {#each [1, 2, 3, 4, 5] as n}
          <button type="button" class="star" onclick={() => (book!.rating = book!.rating === n ? null : n)}>
            {(book.rating ?? 0) >= n ? '★' : '☆'}
          </button>
        {/each}
      </div>
    </label>

    <label>Avis <textarea rows="5" bind:value={book.review}></textarea></label>

    <div class="actions">
      <button class="delete" onclick={remove}>Supprimer</button>
      <button class="save" onclick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </div>
  </div>
{/if}

<style>
  .header { padding: 0.75rem 1rem; }
  .header button { background: none; border: none; color: inherit; cursor: pointer; }
  .detail { display: flex; flex-direction: column; gap: 0.75rem; padding: 0 1rem 2rem; }
  .cover { width: 140px; align-self: center; border-radius: 0.5rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; opacity: 0.8; }
  input, select, textarea {
    padding: 0.6rem; border-radius: 0.4rem; border: 1px solid #444; background: #1e1e1e; color: inherit; font-size: 1rem; font-family: inherit;
  }
  .checkbox { flex-direction: row; align-items: center; gap: 0.5rem; }
  .stars { display: flex; gap: 0.25rem; }
  .star { background: none; border: none; font-size: 1.75rem; color: #e8b84b; cursor: pointer; padding: 0; line-height: 1; }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .actions button { flex: 1; padding: 0.7rem; border-radius: 0.4rem; border: none; }
  .save { background: #e8b84b; font-weight: 600; }
  .delete { background: #1e1e1e; color: #ff6b6b; border: 1px solid #444; }
</style>
