<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { searchCoverCandidates, lookupByIsbn, type BookLookupResult } from '../bookLookup'
  import { createBarcodeScanner } from '../scanner'

  let {
    seriesTitle,
    volume,
    isCollector,
    knownCovers,
    onclose,
    onpick,
    onscanned,
  }: {
    seriesTitle: string
    volume: number
    isCollector: boolean
    /** Couvertures déjà connues pour ce tome (MangaDex, résultats de recherche). */
    knownCovers: string[]
    onclose: () => void
    onpick: (url: string) => void
    /** Un scan identifie l'édition exacte : le parent remplace tout le résultat, pas juste la couverture. */
    onscanned: (result: BookLookupResult) => void
  } = $props()

  const scanner = createBarcodeScanner()

  // untrack : le volet est remonté à chaque ouverture, ces valeurs n'amorcent l'état qu'au
  // montage. Les rendre réactives écraserait la recherche en cours de saisie.
  let candidates = $state<string[]>(untrack(() => knownCovers))
  let loading = $state(false)
  let query = $state(untrack(() => `${seriesTitle} Tome ${volume}${isCollector ? ' édition collector' : ''}`))
  let urlInput = $state('')
  let scanning = $state(false)

  async function runSearch() {
    if (!query.trim()) return
    loading = true
    const extra = await searchCoverCandidates(query, null, seriesTitle)
    candidates = [...new Set([...knownCovers, ...extra])]
    loading = false
  }
  runSearch()

  function stopScan() {
    scanner.stop()
    scanning = false
  }

  async function openScanner() {
    scanning = true
    const started = await scanner.start('volume-scanner', applyScan)
    if (!started) scanning = false
  }

  /** Le code-barre identifie l'édition exacte que l'utilisateur a en main (ISBN propre à chaque
   * édition, collector incluse) — pas d'ambiguïté possible, contrairement à une recherche par
   * mots-clés : on applique directement, sans passer par une liste de candidats à trier. */
  async function applyScan(isbn: string) {
    const result = await lookupByIsbn(isbn)
    stopScan()
    if (result) onscanned(result)
  }

  function close() {
    stopScan()
    onclose()
  }

  // La caméra doit s'éteindre même si le parent démonte le volet sans passer par close().
  onDestroy(() => scanner.stop())
</script>

<div class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" role="presentation" onclick={close}>
  <div
    class="w-full sm:max-w-md max-h-[78vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4 gap-4 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && close()}
  >
    <div class="flex items-center justify-between font-serif font-bold text-base text-slate-900 dark:text-white">
      <span>Couverture — Tome {volume}</span>
      <button class="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white" onclick={close} aria-label="Fermer">✕</button>
    </div>
    {#if scanning}
      <div class="relative w-full aspect-square rounded-2xl bg-black overflow-hidden border border-light-border dark:border-app-border">
        <div id="volume-scanner" class="w-full h-full"></div>
      </div>
      <button class="w-full py-2.5 rounded-xl border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 text-sm font-medium" onclick={stopScan}>
        Annuler le scan
      </button>
    {:else}
      <button
        class="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-app-card border border-light-border dark:border-app-border text-white dark:text-slate-100 text-sm font-semibold flex items-center justify-center gap-2"
        onclick={openScanner}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
        Scanner le code-barre de ton exemplaire
      </button>
      <p class="text-[11px] text-slate-400 text-center -mt-2">Identifie l'édition exacte que tu as en main — plus fiable qu'une recherche par mots-clés.</p>
    {/if}
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault()
        runSearch()
      }}
    >
      <input
        type="text"
        bind:value={query}
        placeholder="Éditeur, coffret, deluxe…"
        class="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-app-border bg-light-card dark:bg-app-card text-sm text-slate-900 dark:text-white"
      />
      <button type="submit" class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex-shrink-0" disabled={loading}> Chercher </button>
    </form>
    <form
      class="flex gap-2"
      onsubmit={(e) => {
        e.preventDefault()
        if (urlInput.trim()) onpick(urlInput.trim())
      }}
    >
      <input
        type="url"
        bind:value={urlInput}
        placeholder="Ou colle l'URL d'une image (édition collector…)"
        class="flex-1 px-3 py-2 rounded-lg border border-light-border dark:border-app-border bg-light-card dark:bg-app-card text-sm text-slate-900 dark:text-white"
      />
      <button
        type="submit"
        class="px-3 py-2 rounded-lg border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 text-xs font-semibold flex-shrink-0"
        disabled={!urlInput.trim()}
      >
        Utiliser
      </button>
    </form>
    {#if loading}
      <p class="text-center text-sm text-slate-400 py-5">Recherche…</p>
    {:else if candidates.length === 0}
      <p class="text-center text-sm text-slate-400 py-5">Aucune couverture trouvée pour ce tome.</p>
    {:else}
      <div class="grid grid-cols-3 gap-2.5 overflow-y-auto thin-scrollbar">
        {#each candidates as url (url)}
          <button class="aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent bg-light-card dark:bg-app-card" onclick={() => onpick(url)}>
            <img src={url} alt="Option de couverture" loading="lazy" class="w-full h-full object-cover" />
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
