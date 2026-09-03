<script lang="ts">
  import { untrack } from 'svelte'
  import { parseSeriesVolume } from '../series'
  import { guessCategory } from '../addBook'
  import { CATEGORY_LABEL, STATUS_LABEL, chipClass } from '../bookStyle'
  import type { BookLookupResult } from '../bookLookup'
  import CoverFallback from './CoverFallback.svelte'

  type Category = keyof typeof CATEGORY_LABEL
  type Status = keyof typeof STATUS_LABEL
  // ponytail: "Abandonné" n'a pas de sens au moment d'ajouter un livre, seulement depuis la fiche.
  const ADD_STATUSES: Status[] = ['wishlist', 'reading', 'read']

  let {
    item,
    adding,
    onclose,
    onadd,
  }: {
    item: BookLookupResult
    adding: boolean
    onclose: () => void
    onadd: (item: BookLookupResult, category: Category, status: Status, series: string | null) => void
  } = $props()

  // Pré-remplissage local : la catégorie devinée n'intéresse personne d'autre que ce volet,
  // et l'utilisateur la corrige avec les chips avant d'ajouter.
  // untrack : le volet est remonté pour chaque livre, la valeur devinée n'a donc à être lue
  // qu'au montage. La rendre réactive écraserait le choix de l'utilisateur.
  let category = $state<Category>(untrack(() => guessCategory([item]) as Category))
  let status = $state<Status>('wishlist')

  function submit() {
    const pv = parseSeriesVolume(item.title)
    onadd(item, category, status, pv.volume ? pv.series : null)
  }
</script>

<div class="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center" role="presentation" onclick={onclose}>
  <div
    class="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto thin-scrollbar p-6 pt-8 rounded-t-3xl sm:rounded-2xl flex flex-col gap-3 bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onclose()}
  >
    <button
      class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border text-slate-500 dark:text-slate-300"
      onclick={onclose}
      aria-label="Fermer"
    >
      ✕
    </button>
    <div class="w-24 h-36 rounded-xl overflow-hidden bg-light-card dark:bg-app-card mx-auto mb-1 cover-shadow">
      {#if item.cover_url}<img src={item.cover_url} alt={item.title} class="w-full h-full object-cover" />{:else}<CoverFallback title={item.title} />{/if}
    </div>
    <div class="font-serif text-xl font-bold text-slate-900 dark:text-white text-center">{item.title}</div>
    {#if item.subtitle}<div class="text-sm text-slate-500 dark:text-slate-400 text-center -mt-1.5">{item.subtitle}</div>{/if}
    {#if item.authors.length}<div class="text-sm text-slate-500 dark:text-slate-400 text-center">{item.authors.join(', ')}</div>{/if}
    <div class="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
      {#if item.publisher}<span>{item.publisher}</span>{/if}
      {#if item.publishedDate}<span>{item.publishedDate}</span>{/if}
      {#if item.language}<span>{item.language.toUpperCase()}</span>{/if}
      {#if item.pages}<span>{item.pages} p.</span>{/if}
      {#if item.isbn}<span>ISBN {item.isbn}</span>{/if}
    </div>
    {#if item.categories?.length}
      <div class="flex flex-wrap justify-center gap-1.5">
        {#each item.categories as c (c)}<span class="px-2.5 py-1 rounded-full bg-light-card dark:bg-app-card border border-light-border dark:border-app-border text-[11px] text-slate-500 dark:text-slate-400">{c}</span>{/each}
      </div>
    {/if}
    {#if item.description}<p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-h-48 overflow-y-auto thin-scrollbar">{item.description}</p>{/if}
    <div class="flex flex-wrap gap-2 justify-center">
      {#each Object.keys(CATEGORY_LABEL) as c (c)}
        <button type="button" class={chipClass(category === c)} onclick={() => (category = c as Category)}>{CATEGORY_LABEL[c]}</button>
      {/each}
    </div>
    <div class="flex flex-wrap gap-2 justify-center">
      {#each ADD_STATUSES as s (s)}
        <button type="button" class={chipClass(status === s)} onclick={() => (status = s as Status)}>{STATUS_LABEL[s]}</button>
      {/each}
    </div>
    <button class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50" onclick={submit} disabled={adding}>
      Ajouter à ma bibliothèque
    </button>
  </div>
</div>
