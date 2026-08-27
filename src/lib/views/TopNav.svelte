<script lang="ts">
  import { currentView } from '../nav'
  import { session } from '../auth'
  import { supabase } from '../supabase'
  import { booksStore } from '../booksStore'
  import { filterCategory } from '../collectionFilter'
  import { CATEGORY_DOT_CLASS } from '../bookStyle'

  function signOut() {
    if (confirm('Se déconnecter ?')) supabase.auth.signOut()
  }

  let { active }: { active: 'collection' | 'planning' | 'stats' | 'add' | 'book' } = $props()

  const shelfCategories: { key: string; label: string }[] = [
    { key: 'roman', label: 'Romans' },
    { key: 'manga', label: 'Mangas' },
    { key: 'bd', label: 'Bandes Dessinées' },
    { key: 'comics', label: 'Comics' },
  ]

  const totalCount = $derived($booksStore.length)
  const categoryCount = $derived((key: string) => $booksStore.filter((b) => b.category === key).length)
  const readingCount = $derived($booksStore.filter((b) => b.status === 'reading').length)
  const readCount = $derived($booksStore.filter((b) => b.status === 'read').length)

  function openAllBooks() {
    filterCategory.set('Toutes')
    currentView.set({ name: 'collection' })
  }

  function openCategory(key: string) {
    filterCategory.set(key)
    currentView.set({ name: 'collection' })
  }

  const email = $derived($session?.user?.email ?? '')
  const initials = $derived(
    email
      .split(/[@._]/)[0]
      .slice(0, 2)
      .toUpperCase() || '?',
  )
</script>

<!-- ================= SIDEBAR DESKTOP ================= -->
<aside
  class="hidden md:flex w-64 flex-col bg-light-surface dark:bg-app-surface border-r border-light-border dark:border-app-border flex-shrink-0 transition-colors"
>
  <!-- Logo -->
  <div class="h-16 px-5 flex items-center justify-between border-b border-light-border dark:border-app-border">
    <button class="flex items-center gap-2.5" onclick={() => currentView.set({ name: 'collection' })}>
      <div
        class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path
            d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5v-13z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          /><path d="M9 8.5l1.5 1.5L13 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </div>
      <span class="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">BiblioLog</span>
    </button>
  </div>

  <!-- Navigation Principale -->
  <div class="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-6">
    <div>
      <div class="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Rayonnages</div>
      <nav class="space-y-1">
        <button
          class={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-sm transition ${
            active === 'collection'
              ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          onclick={openAllBooks}
        >
          <div class="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-indigo-600 dark:text-indigo-400"
              ><rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.6" /><rect
                x="13.5"
                y="3.5"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.6"
              /><rect x="3.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.6" /><rect
                x="13.5"
                y="13.5"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
                stroke-width="1.6"
              /></svg
            >
            <span>Tous les volumes</span>
          </div>
          <span
            class="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-white/5 px-2 py-0.5 rounded shadow-sm dark:shadow-none border border-slate-200 dark:border-transparent"
            >{totalCount}</span
          >
        </button>

        {#each shelfCategories as c (c.key)}
          <button
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200 text-sm transition"
            onclick={() => openCategory(c.key)}
          >
            <div class="flex items-center gap-2.5">
              <span class={`w-2 h-2 rounded-full ${CATEGORY_DOT_CLASS[c.key]}`}></span>
              <span>{c.label}</span>
            </div>
            <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{categoryCount(c.key)}</span>
          </button>
        {/each}
      </nav>
    </div>

    <!-- Statuts -->
    <div>
      <div class="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">États</div>
      <nav class="space-y-1 text-sm">
        <button class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition" onclick={() => currentView.set({ name: 'collection' })}>
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-amber-500"
              ><path d="M12 2c1 3-3 4-3 7a3 3 0 006 0c1.5 1 2 3 2 4.5A5.5 5.5 0 0112 19a5.5 5.5 0 01-5.5-5.5c0-3 2-4 2-7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg
            >
            <span>En cours</span>
          </div>
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{readingCount}</span>
        </button>
        <button class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition" onclick={() => currentView.set({ name: 'collection' })}>
          <div class="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-emerald-500"
              ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" /><path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg
            >
            <span>Lus</span>
          </div>
          <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{readCount}</span>
        </button>
      </nav>
    </div>

    <nav class="space-y-1 pt-2 border-t border-light-border dark:border-app-border">
      <button
        class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
          active === 'planning'
            ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
        }`}
        onclick={() => currentView.set({ name: 'planning' })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.6" /><path d="M8 3v4M16 3v4M4 10.5h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg
        >
        <span>Planning</span>
      </button>
      <button
        class={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
          active === 'stats'
            ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
        }`}
        onclick={() => currentView.set({ name: 'stats' })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path d="M5 20V10M11 20V4M17 20v-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg
        >
        <span>Statistiques</span>
      </button>
    </nav>
  </div>

  <!-- Profil -->
  <div class="p-3 border-t border-light-border dark:border-app-border bg-slate-50 dark:bg-app-bg/50">
    <div class="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-white/5 border border-light-border dark:border-app-border shadow-sm dark:shadow-none">
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
        {initials}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-slate-900 dark:text-white truncate">{email}</p>
        <p class="text-[10px] font-mono text-slate-500 truncate">Supabase Sync</p>
      </div>
      <button class="p-1.5 rounded-md text-slate-400 hover:text-red-500 flex-shrink-0" onclick={signOut} aria-label="Se déconnecter" title="Se déconnecter">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          ><path d="M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </button>
    </div>
  </div>
</aside>

<!-- Navigation Mobile -->
<nav
  class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-light-surface/90 dark:bg-app-surface/90 backdrop-blur-xl border-t border-light-border dark:border-app-border flex items-center justify-around px-4 z-20"
>
  <button
    class={`flex flex-col items-center gap-1 ${active === 'collection' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
    onclick={() => currentView.set({ name: 'collection' })}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      ><rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.6" /><rect
        x="3.5"
        y="13.5"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        stroke-width="1.6"
      /><rect x="13.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.6" /></svg
    >
    <span class="text-[10px] font-medium">Étagères</span>
  </button>
  <button class="flex flex-col items-center gap-1 text-slate-400" onclick={() => currentView.set({ name: 'add' })}>
    <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white -mt-3 shadow-lg shadow-indigo-600/40">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
    </div>
    <span class="text-[10px] font-medium">Ajout</span>
  </button>
  <button
    class={`flex flex-col items-center gap-1 ${active === 'stats' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
    onclick={() => currentView.set({ name: 'stats' })}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 20V10M11 20V4M17 20v-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    <span class="text-[10px] font-medium">Stats</span>
  </button>
</nav>
