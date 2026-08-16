<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'

  let books = $state<Book[]>([])
  let loading = $state(true)
  let category = $state<string>('')
  let sort = $state<'date_added' | 'rating' | 'title'>('date_added')

  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']

  async function load() {
    loading = true
    let query = supabase.from('books').select('*')
    if (category) query = query.eq('category', category)
    query = query.order(sort, { ascending: sort === 'title' })
    const { data } = await query
    books = data ?? []
    loading = false
  }

  $effect(() => {
    category
    sort
    load()
  })
</script>

<div class="toolbar">
  <select bind:value={category}>
    <option value="">Toutes catégories</option>
    {#each categories as c}
      <option value={c}>{c}</option>
    {/each}
  </select>
  <select bind:value={sort}>
    <option value="date_added">Date d'ajout</option>
    <option value="rating">Note</option>
    <option value="title">Titre</option>
  </select>
  <button onclick={() => supabase.auth.signOut()}>Déconnexion</button>
</div>

{#if loading}
  <p class="empty">Chargement…</p>
{:else if books.length === 0}
  <p class="empty">Aucun livre pour l'instant. Ajoute-en un !</p>
{:else}
  <div class="grid">
    {#each books as book (book.id)}
      <button class="card" onclick={() => currentView.set({ name: 'book', id: book.id })}>
        {#if book.cover_url}
          <img src={book.cover_url} alt={book.title} />
        {:else}
          <div class="cover-placeholder">{book.title}</div>
        {/if}
        <span class="title">{book.title}</span>
        {#if book.rating}<span class="rating">{'★'.repeat(book.rating)}</span>{/if}
      </button>
    {/each}
  </div>
{/if}

<button class="fab" onclick={() => currentView.set({ name: 'add' })}>+</button>

<style>
  .toolbar {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    position: sticky;
    top: 0;
    background: #141414;
    z-index: 10;
  }
  .toolbar select, .toolbar button {
    padding: 0.4rem;
    border-radius: 0.4rem;
    border: 1px solid #444;
    background: #1e1e1e;
    color: inherit;
  }
  .toolbar button {
    margin-left: auto;
  }
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    opacity: 0.6;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.75rem;
    padding: 0 1rem 6rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }
  .card img, .cover-placeholder {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border-radius: 0.4rem;
    background: #262626;
  }
  .cover-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    font-size: 0.75rem;
    text-align: center;
  }
  .title {
    font-size: 0.8rem;
    line-height: 1.2;
  }
  .rating {
    color: #e8b84b;
    font-size: 0.75rem;
  }
  .fab {
    position: fixed;
    bottom: calc(1.5rem + env(safe-area-inset-bottom));
    right: 1.5rem;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: #e8b84b;
    border: none;
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
</style>
