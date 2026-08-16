<script lang="ts">
  import { onDestroy } from 'svelte'
  import { supabase } from '../supabase'
  import { currentView } from '../nav'
  import { searchByTitle, lookupByIsbn, type BookLookupResult } from '../bookLookup'

  type Mode = 'search' | 'isbn' | 'scan'

  let mode = $state<Mode>('search')
  let query = $state('')
  let isbnInput = $state('')
  let results = $state<BookLookupResult[]>([])
  let searching = $state(false)
  let scannerActive = $state(false)
  let scanError = $state<string | null>(null)

  let form = $state<BookLookupResult & { series: string; category: string; isCollector: boolean }>({
    isbn: null,
    title: '',
    authors: [],
    publisher: null,
    cover_url: null,
    series: '',
    category: 'roman',
    isCollector: false,
  })
  let showForm = $state(false)
  let saving = $state(false)

  async function runSearch() {
    if (!query.trim()) return
    searching = true
    results = await searchByTitle(query)
    searching = false
  }

  async function runIsbnLookup(isbn: string) {
    searching = true
    const result = await lookupByIsbn(isbn)
    searching = false
    if (result) {
      pickResult(result)
    } else {
      // rien trouvé dans aucune API : saisie manuelle
      pickResult({ isbn, title: '', authors: [], publisher: null, cover_url: null })
    }
  }

  function pickResult(result: BookLookupResult) {
    form = {
      ...result,
      series: '',
      category: 'roman',
      isCollector: false,
    }
    showForm = true
    stopScanner()
  }

  let html5QrCode: import('html5-qrcode').Html5Qrcode | null = null

  async function startScanner() {
    scanError = null
    scannerActive = true
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('scanner')
    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decodedText) => {
          runIsbnLookup(decodedText)
        },
        () => {},
      )
    } catch (e) {
      scanError = "Impossible d'accéder à la caméra (HTTPS requis, vérifie les permissions)."
      scannerActive = false
    }
  }

  function stopScanner() {
    if (html5QrCode) {
      html5QrCode.stop().catch(() => {})
      html5QrCode = null
    }
    scannerActive = false
  }

  onDestroy(stopScanner)

  async function save() {
    saving = true
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('books').insert({
      user_id: userData.user?.id,
      isbn: form.isbn,
      title: form.title,
      authors: form.authors,
      publisher: form.publisher,
      series: form.series || null,
      category: form.category,
      cover_url: form.cover_url,
      is_collector_edition: form.isCollector,
    })
    saving = false
    if (!error) currentView.set({ name: 'library' })
  }
</script>

<div class="header">
  <button onclick={() => currentView.set({ name: 'library' })}>← Retour</button>
  <h2>Ajouter un livre</h2>
</div>

{#if !showForm}
  <div class="tabs">
    <button class:active={mode === 'search'} onclick={() => { mode = 'search'; stopScanner() }}>Recherche</button>
    <button class:active={mode === 'isbn'} onclick={() => { mode = 'isbn'; stopScanner() }}>ISBN</button>
    <button class:active={mode === 'scan'} onclick={() => { mode = 'scan'; startScanner() }}>Scanner</button>
  </div>

  {#if mode === 'search'}
    <form class="row" onsubmit={(e) => { e.preventDefault(); runSearch() }}>
      <input placeholder="Titre ou auteur" bind:value={query} />
      <button type="submit">Chercher</button>
    </form>
  {:else if mode === 'isbn'}
    <form class="row" onsubmit={(e) => { e.preventDefault(); runIsbnLookup(isbnInput) }}>
      <input placeholder="ISBN" bind:value={isbnInput} />
      <button type="submit">Chercher</button>
    </form>
  {:else if mode === 'scan'}
    <div id="scanner"></div>
    {#if scanError}<p class="error">{scanError}</p>{/if}
  {/if}

  {#if searching}<p class="empty">Recherche…</p>{/if}

  <div class="results">
    {#each results as r}
      <button class="result" onclick={() => pickResult(r)}>
        {#if r.cover_url}<img src={r.cover_url} alt={r.title} />{/if}
        <div>
          <strong>{r.title}</strong>
          <p>{r.authors.join(', ')}</p>
        </div>
      </button>
    {/each}
  </div>

  {#if mode !== 'scan' && !searching}
    <button class="manual" onclick={() => pickResult({ isbn: null, title: '', authors: [], publisher: null, cover_url: null })}>
      Saisir un livre manuellement
    </button>
  {/if}
{:else}
  <form class="book-form" onsubmit={(e) => { e.preventDefault(); save() }}>
    {#if form.cover_url}<img class="cover-preview" src={form.cover_url} alt="" />{/if}
    <label>Titre <input required bind:value={form.title} /></label>
    <label>Auteur(s), séparés par virgule
      <input
        value={form.authors.join(', ')}
        oninput={(e) => (form.authors = (e.target as HTMLInputElement).value.split(',').map((a) => a.trim()).filter(Boolean))}
      />
    </label>
    <label>Éditeur <input bind:value={form.publisher} /></label>
    <label>Série <input bind:value={form.series} /></label>
    <label>Catégorie
      <select bind:value={form.category}>
        <option value="roman">Roman</option>
        <option value="bd">BD</option>
        <option value="manga">Manga</option>
        <option value="comics">Comics</option>
        <option value="autre">Autre</option>
      </select>
    </label>
    <label class="checkbox"><input type="checkbox" bind:checked={form.isCollector} /> Édition collector</label>
    <div class="actions">
      <button type="button" onclick={() => (showForm = false)}>Annuler</button>
      <button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </div>
  </form>
{/if}

<style>
  .header { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; }
  .header button { background: none; border: none; color: inherit; cursor: pointer; }
  .tabs { display: flex; gap: 0.5rem; padding: 0 1rem 0.75rem; }
  .tabs button { flex: 1; padding: 0.5rem; border-radius: 0.4rem; border: 1px solid #444; background: #1e1e1e; color: inherit; }
  .tabs button.active { background: #e8b84b; color: #141414; border-color: #e8b84b; }
  .row { display: flex; gap: 0.5rem; padding: 0 1rem 0.75rem; }
  .row input { flex: 1; padding: 0.6rem; border-radius: 0.4rem; border: 1px solid #444; background: #1e1e1e; color: inherit; }
  .row button { padding: 0.6rem 1rem; border-radius: 0.4rem; border: none; background: #e8b84b; }
  #scanner { margin: 0 1rem; border-radius: 0.5rem; overflow: hidden; }
  .error { color: #ff6b6b; padding: 0 1rem; }
  .empty { text-align: center; opacity: 0.6; padding: 1rem; }
  .results { display: flex; flex-direction: column; gap: 0.5rem; padding: 0 1rem; }
  .result { display: flex; gap: 0.75rem; align-items: center; background: #1e1e1e; border: none; border-radius: 0.5rem; padding: 0.5rem; color: inherit; cursor: pointer; text-align: left; }
  .result img { width: 40px; height: 60px; object-fit: cover; border-radius: 0.25rem; }
  .manual { margin: 1rem; background: none; border: 1px dashed #666; color: inherit; padding: 0.6rem; border-radius: 0.4rem; cursor: pointer; }
  .book-form { display: flex; flex-direction: column; gap: 0.75rem; padding: 0 1rem 2rem; }
  .book-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; opacity: 0.8; }
  .book-form input, .book-form select { padding: 0.6rem; border-radius: 0.4rem; border: 1px solid #444; background: #1e1e1e; color: inherit; font-size: 1rem; }
  .checkbox { flex-direction: row !important; align-items: center; gap: 0.5rem !important; }
  .cover-preview { width: 100px; align-self: center; border-radius: 0.4rem; }
  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .actions button { flex: 1; padding: 0.7rem; border-radius: 0.4rem; border: none; }
  .actions button[type='submit'] { background: #e8b84b; font-weight: 600; }
  .actions button[type='button'] { background: #1e1e1e; color: inherit; border: 1px solid #444; }
</style>
