<script lang="ts">
  import { supabase, type Book, type Quote } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_BADGE_CLASS, STATUS_LABEL } from '../bookStyle'
  import { searchCoverCandidates } from '../bookLookup'
  import { booksStore } from '../booksStore'

  let { id }: { id: string } = $props()

  let book = $state<Book | null>(null)
  let saving = $state(false)
  let deleting = $state(false)
  let deleteConfirmOpen = $state(false)
  let coverPickerOpen = $state(false)
  let coverLoading = $state(false)
  let coverCandidates = $state<string[]>([])
  let quotes = $state<Quote[]>([])
  let newQuoteText = $state('')
  let newQuotePage = $state('')

  // ponytail: un seul résultat (le cas courant) = on l'applique direct, pas de modale à un choix.
  // Plusieurs résultats = vraies jaquettes alternatives, on laisse choisir pour ne pas se tromper.
  async function openCoverPicker() {
    if (!book) return
    coverLoading = true
    const results = await searchCoverCandidates(`${book.title} ${book.authors.join(' ')}`, book.isbn, book.title)
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
    const { data: q } = await supabase.from('quotes').select('*').eq('book_id', id).order('created_at', { ascending: true })
    quotes = q ?? []
  }
  load()

  const categories = ['roman', 'bd', 'manga', 'comics', 'autre']
  const statuses: Book['status'][] = ['wishlist', 'reading', 'read', 'abandoned']

  const progressPct = $derived(book?.pages ? Math.min(100, Math.round(((book.pages_read ?? 0) / book.pages) * 100)) : null)
  const pagesRemaining = $derived(book?.pages ? Math.max(0, book.pages - (book.pages_read ?? 0)) : null)

  function close() {
    currentView.set({ name: 'collection' })
  }

  async function save() {
    if (!book) return
    saving = true
    const date_read = book.status === 'read' ? (book.date_read ?? new Date().toISOString().slice(0, 10)) : book.date_read
    const payload = {
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      cover_url: book.cover_url,
      series: book.series,
      category: book.category,
      status: book.status,
      pages_read: book.pages_read,
      is_collector_edition: book.is_collector_edition,
      rating: book.rating,
      review: book.review,
      date_read,
    }
    const { error } = await supabase.from('books').update(payload).eq('id', book.id)
    saving = false
    if (error) return
    const updated = { ...book, ...payload }
    booksStore.update((list) => list.map((b) => (b.id === updated.id ? updated : b)))
    close()
  }

  async function remove() {
    if (!book) return
    deleting = true
    const { error } = await supabase.from('books').delete().eq('id', book.id)
    deleting = false
    if (error) return
    booksStore.update((list) => list.filter((b) => b.id !== book!.id))
    deleteConfirmOpen = false
    close()
  }

  async function addQuote() {
    if (!book || !newQuoteText.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('quotes')
      .insert({
        book_id: book.id,
        user_id: userData.user?.id,
        text: newQuoteText.trim(),
        page: newQuotePage.trim() ? Number(newQuotePage.trim()) : null,
      })
      .select()
      .single()
    if (data) quotes = [...quotes, data]
    newQuoteText = ''
    newQuotePage = ''
  }

  async function removeQuote(quoteId: string) {
    await supabase.from('quotes').delete().eq('id', quoteId)
    quotes = quotes.filter((q) => q.id !== quoteId)
  }
</script>

{#if book}
  {@const b = book}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-30" role="presentation" onclick={close}></div>
  <aside
    class="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-light-surface dark:bg-app-surface border-l border-light-border dark:border-app-border shadow-2xl z-40 flex flex-col"
  >
    <div class="h-16 px-6 border-b border-light-border dark:border-app-border flex items-center justify-between flex-shrink-0">
      <span class="text-xs font-mono text-slate-500 uppercase tracking-wider">Fiche livre</span>
      <button class="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white" onclick={close} aria-label="Fermer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-6">
      <div class="flex flex-col items-center text-center">
        <div class="w-32 aspect-[2/3] rounded-lg overflow-hidden cover-shadow border border-light-border dark:border-app-border mb-4 bg-light-card dark:bg-app-card">
          {#if b.cover_url}<img src={b.cover_url} alt={b.title} class="w-full h-full object-contain" />{/if}
        </div>
        <span class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border mb-2 ${CATEGORY_BADGE_CLASS[b.category]}`}>{CATEGORY_LABEL[b.category].toUpperCase()}</span>
        <h3 class="font-serif text-2xl font-bold text-slate-900 dark:text-white">{b.title || 'Sans titre'}</h3>
        <p class="text-xs text-slate-400 mt-1">{b.authors.join(', ') || 'Auteur inconnu'}{b.publisher ? ` • ${b.publisher}` : ''}</p>
        <button class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 underline disabled:opacity-50" onclick={openCoverPicker} disabled={coverLoading}>
          {coverLoading ? 'Recherche…' : 'Améliorer la qualité de la couverture'}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-1.5">
        {#each statuses as s (s)}
          <button
            class={`px-3 py-1.5 rounded-full text-xs font-mono font-medium text-center transition ${
              b.status === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
            }`}
            onclick={() => (b.status = s)}
          >
            {STATUS_LABEL[s]}
          </button>
        {/each}
      </div>

      {#if b.pages}
        <div class="p-4 rounded-xl bg-light-card dark:bg-app-card border border-light-border dark:border-app-border space-y-2">
          <div class="flex justify-between items-center text-xs font-mono">
            <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" class="text-indigo-600 dark:text-indigo-400"
                ><path d="M6 4h9a2 2 0 012 2v14l-6.5-3L4 20V6a2 2 0 012-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg
              >
              Page actuelle
            </span>
            <span class="text-slate-900 dark:text-white font-semibold">{b.pages_read} sur {b.pages} ({progressPct}%)</span>
          </div>
          <input type="range" min="0" max={b.pages} bind:value={b.pages_read} class="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-app-bg rounded-lg cursor-pointer" />
          <div class="flex justify-between text-[11px] font-mono text-slate-500">
            <span>{b.date_added ? `Ajouté le ${new Date(b.date_added).toLocaleDateString('fr-FR')}` : ''}</span>
            {#if pagesRemaining !== null}<span class="text-indigo-600 dark:text-indigo-400">{pagesRemaining} pages restantes</span>{/if}
          </div>
        </div>
      {/if}

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Titre</span>
        <input
          bind:value={b.title}
          class="w-full py-2 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
        />
      </div>
      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Auteur(s)</span>
        <input
          value={b.authors.join(', ')}
          oninput={(e) => (b.authors = (e.target as HTMLInputElement).value.split(',').map((a) => a.trim()).filter(Boolean))}
          class="w-full py-2 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
        />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Éditeur</span>
          <input
            bind:value={b.publisher}
            class="w-full py-2 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
          />
        </div>
        <div class="space-y-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Série</span>
          <input
            bind:value={b.series}
            class="w-full py-2 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>
      <label class="flex flex-row items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" bind:checked={b.is_collector_edition} /> Édition collector
      </label>

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catégorie</span>
        <div class="flex flex-wrap gap-2">
          {#each categories as c (c)}
            <button
              class={`px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition ${
                b.category === c ? CATEGORY_BADGE_CLASS[c] : 'border-light-border dark:border-app-border text-slate-500 dark:text-slate-400 bg-light-surface dark:bg-app-surface'
              }`}
              onclick={() => (b.category = c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ta note</span>
        <div class="flex gap-1.5">
          {#each [1, 2, 3, 4, 5] as n}
            <button type="button" class="text-2xl leading-none text-amber-500" onclick={() => (b.rating = b.rating === n ? null : n)}>
              {(b.rating ?? 0) >= n ? '★' : '☆'}
            </button>
          {/each}
        </div>
      </div>

      <div class="p-4 rounded-xl bg-light-card dark:bg-app-card border border-light-border dark:border-app-border space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-serif text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-indigo-600 dark:text-indigo-400"
              ><path d="M7 8h.01M7 8a2 2 0 00-2 2v3a2 2 0 002 2M7 8a2 2 0 012-2h1M13 8h.01M13 8a2 2 0 00-2 2v3a2 2 0 002 2M13 8a2 2 0 012-2h1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg
            >
            Citations
          </h4>
          <span class="text-[10px] font-mono text-slate-400">{quotes.length}</span>
        </div>
        {#if quotes.length > 0}
          <div class="space-y-2.5">
            {#each quotes as q (q.id)}
              <div class="p-3 rounded-lg bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border space-y-1.5 relative group">
                <p class="font-serif italic text-slate-700 dark:text-slate-200 text-sm leading-relaxed pr-5">« {q.text} »</p>
                <div class="text-[10px] font-mono text-slate-500 text-right">{q.page ? `Page ${q.page}` : ''}</div>
                <button
                  class="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  onclick={() => removeQuote(q.id)}
                  aria-label="Supprimer la citation"
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        {/if}
        <div class="flex flex-col gap-2">
          <textarea
            rows="2"
            bind:value={newQuoteText}
            placeholder="Ajouter une citation…"
            class="w-full bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
          ></textarea>
          <div class="flex gap-2">
            <input
              type="number"
              bind:value={newQuotePage}
              placeholder="Page"
              class="w-20 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
            />
            <button class="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50" onclick={addQuote} disabled={!newQuoteText.trim()}>
              + Ajouter
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes de lecture</span>
        <textarea
          rows="4"
          bind:value={b.review}
          placeholder="Qu'as-tu pensé de ce livre ?"
          class="w-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
        ></textarea>
      </div>

      <div class="flex gap-2 pb-2">
        <button class="flex-1 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-semibold" onclick={() => (deleteConfirmOpen = true)}> Supprimer </button>
        <button class="flex-[1.4] py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-60" onclick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </aside>
{/if}

{#if coverPickerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
    onclick={() => (coverPickerOpen = false)}
    onkeydown={(e) => e.key === 'Escape' && (coverPickerOpen = false)}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="w-full sm:max-w-md max-h-[78vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4 gap-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between font-serif font-bold text-base text-slate-900 dark:text-white">
        <span>Choisir une couverture</span>
        <button class="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white" onclick={() => (coverPickerOpen = false)} aria-label="Fermer">✕</button>
      </div>
      {#if coverLoading}
        <p class="text-center text-sm text-slate-400 py-5">Recherche…</p>
      {:else if coverCandidates.length === 0}
        <p class="text-center text-sm text-slate-400 py-5">Aucune autre couverture trouvée.</p>
      {:else}
        <div class="grid grid-cols-3 gap-2.5 overflow-y-auto thin-scrollbar">
          {#each coverCandidates as url (url)}
            <button
              class={`aspect-[2/3] rounded-lg overflow-hidden border-2 ${url === book?.cover_url ? 'border-indigo-500' : 'border-transparent'} bg-light-card dark:bg-app-card`}
              onclick={() => pickCover(url)}
            >
              <img src={url} alt="Option de couverture" loading="lazy" class="w-full h-full object-cover" />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if deleteConfirmOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
    onclick={() => (deleteConfirmOpen = false)}
    onkeydown={(e) => e.key === 'Escape' && (deleteConfirmOpen = false)}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="bg-light-surface dark:bg-app-surface border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 class="font-serif text-lg font-bold text-red-500">Supprimer cet ouvrage ?</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Cette action est irréversible et supprimera également les citations et notes associées.
      </p>
      <div class="flex gap-3 mt-1">
        <button
          class="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-light-border dark:border-app-border text-slate-700 dark:text-slate-300 text-xs font-medium"
          onclick={() => (deleteConfirmOpen = false)}
          disabled={deleting}
        >
          Annuler
        </button>
        <button
          class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-60"
          onclick={remove}
          disabled={deleting}
        >
          {deleting ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </div>
    </div>
  </div>
{/if}
