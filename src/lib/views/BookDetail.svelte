<script lang="ts">
  import { supabase, type Book } from '../supabase'
  import { currentView } from '../nav'
  import { CATEGORY_LABEL, CATEGORY_BADGE_CLASS, STATUS_LABEL } from '../bookStyle'
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
  <div class="pb-10 md:max-w-3xl md:mx-auto">
    <div class="p-4 md:p-8">
      <button
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition text-xs font-medium mb-6"
        onclick={() => currentView.set({ name: 'collection' })}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Retour
      </button>

      <div
        class="p-6 md:p-8 rounded-2xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border shadow-sm dark:shadow-none flex flex-col md:flex-row gap-8 items-center md:items-start"
      >
        <div class="w-40 md:w-56 aspect-[2/3] rounded-xl overflow-hidden bg-light-card dark:bg-app-card border border-light-border dark:border-app-border cover-shadow flex-shrink-0">
          {#if book.cover_url}<img src={book.cover_url} alt={book.title} class="w-full h-full object-contain" />{/if}
        </div>

        <div class="flex-1 space-y-5 w-full text-center md:text-left">
          <div>
            <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
              <span class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${CATEGORY_BADGE_CLASS[book.category]}`}>{CATEGORY_LABEL[book.category].toUpperCase()}</span>
              {#if book.isbn}<span class="text-xs font-mono text-slate-400 dark:text-slate-500">ISBN: {book.isbn}</span>{/if}
            </div>
            <h2 class="font-serif text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{book.title || 'Sans titre'}</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{book.authors.join(', ') || 'Auteur inconnu'}{book.publisher ? ` • ${book.publisher}` : ''}</p>
            <button
              class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 underline disabled:opacity-50"
              onclick={openCoverPicker}
              disabled={coverLoading}
            >
              {coverLoading ? 'Recherche…' : 'Améliorer la qualité de la couverture'}
            </button>
          </div>

          <div class="flex bg-slate-100 dark:bg-app-bg p-1 rounded-lg border border-light-border dark:border-app-border justify-center md:justify-start">
            {#each statuses as s (s)}
              <button
                class={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-mono font-medium transition ${
                  book.status === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                onclick={() => book && (book.status = s)}
              >
                {STATUS_LABEL[s]}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-6 p-6 rounded-2xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border space-y-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Titre</span>
          <input
            bind:value={book.title}
            class="py-2.5 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Auteur(s)</span>
          <input
            value={book.authors.join(', ')}
            oninput={(e) => (book!.authors = (e.target as HTMLInputElement).value.split(',').map((a) => a.trim()).filter(Boolean))}
            class="py-2.5 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
          />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Éditeur</span>
            <input
              bind:value={book.publisher}
              class="py-2.5 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Série</span>
            <input
              bind:value={book.series}
              class="py-2.5 border-0 border-b border-light-border dark:border-app-border bg-transparent outline-none text-slate-900 dark:text-white text-sm focus:border-indigo-500 transition-colors"
            />
          </label>
        </div>
        <label class="flex flex-row items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" bind:checked={book.is_collector_edition} /> Édition collector
        </label>
      </div>

      <div class="mt-6 space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Catégorie</span>
        <div class="flex flex-wrap gap-2">
          {#each categories as c (c)}
            <button
              class={`px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium transition ${
                book.category === c ? CATEGORY_BADGE_CLASS[c] : 'border-light-border dark:border-app-border text-slate-500 dark:text-slate-400 bg-light-surface dark:bg-app-surface'
              }`}
              onclick={() => book && (book.category = c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          {/each}
        </div>
      </div>

      <div class="mt-6 p-6 rounded-2xl bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border space-y-3">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ta note</span>
        <div class="flex gap-1.5">
          {#each [1, 2, 3, 4, 5] as n}
            <button type="button" class="text-2xl leading-none text-amber-500" onclick={() => (book!.rating = book!.rating === n ? null : n)}>
              {(book.rating ?? 0) >= n ? '★' : '☆'}
            </button>
          {/each}
        </div>
      </div>

      <label class="mt-6 flex flex-col gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avis</span>
        <textarea
          rows="5"
          bind:value={book.review}
          placeholder="Qu'as-tu pensé de ce livre ?"
          class="w-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
        ></textarea>
      </label>

      <div class="mt-6 flex gap-3">
        <button
          class="flex-1 py-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm font-semibold"
          onclick={remove}
        >
          Supprimer
        </button>
        <button
          class="flex-[1.4] py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-60"
          onclick={save}
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if coverPickerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center"
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
