<script lang="ts">
  import { currentView } from '../nav'
  import { theme, toggleTheme } from '../theme'

  let { active }: { active: 'collection' | 'planning' | 'stats' | 'add' | 'book' } = $props()

  const items: { key: 'collection' | 'planning' | 'stats'; label: string }[] = [
    { key: 'collection', label: 'Collection' },
    { key: 'planning', label: 'Planning' },
    { key: 'stats', label: 'Statistiques' },
  ]

  function iconFor(key: string) {
    switch (key) {
      case 'collection':
        return 'M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z'
      case 'planning':
        return 'M4 6a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM8 3v4M16 3v4M4 9.5h16'
      default:
        return 'M5 20V10M11 20V4M17 20v-7'
    }
  }

  function sidebarItemClass(key: string) {
    return active === key
      ? 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-medium'
      : 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
  }

  function sidebarIconClass(key: string) {
    return active === key ? 'text-indigo-600 dark:text-indigo-400' : ''
  }

  function bottomItemClass(key: string) {
    return active === key ? 'flex flex-col items-center gap-1 text-indigo-600 dark:text-indigo-400' : 'flex flex-col items-center gap-1 text-slate-400'
  }
</script>

<!-- Sidebar desktop -->
<aside
  class="hidden md:flex w-64 flex-col bg-light-surface dark:bg-app-surface border-r border-light-border dark:border-app-border flex-shrink-0 transition-colors"
>
  <div class="h-16 px-5 flex items-center justify-between border-b border-light-border dark:border-app-border">
    <button
      class="flex items-center gap-2.5"
      onclick={() => currentView.set({ name: 'collection' })}
    >
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

  <div class="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-6">
    <nav class="space-y-1">
      {#each items as item (item.key)}
        <button class={sidebarItemClass(item.key)} onclick={() => currentView.set({ name: item.key })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class={sidebarIconClass(item.key)}
            ><path d={iconFor(item.key)} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
          >
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>

    <button
      class="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-md shadow-indigo-600/20"
      onclick={() => currentView.set({ name: 'add' })}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        ><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg
      >
      <span>Ajouter un livre</span>
    </button>
  </div>

  <div class="p-3 border-t border-light-border dark:border-app-border">
    <button
      onclick={toggleTheme}
      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm transition"
    >
      {#if $theme === 'dark'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" /><path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          /></svg
        >
        <span>Mode clair</span>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg
        >
        <span>Mode sombre</span>
      {/if}
    </button>
  </div>
</aside>

<!-- Topbar mobile -->
<header
  class="md:hidden h-14 px-4 flex items-center justify-between bg-light-surface/90 dark:bg-app-surface/90 backdrop-blur-md border-b border-light-border dark:border-app-border sticky top-0 z-10"
>
  <button class="font-serif text-xl font-bold text-slate-900 dark:text-white" onclick={() => currentView.set({ name: 'collection' })}>
    Biblio<span class="text-indigo-600 dark:text-indigo-400 italic">Log</span>
  </button>
  <button
    onclick={toggleTheme}
    class="p-2 rounded-lg bg-slate-100 dark:bg-app-bg border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300"
    aria-label="Changer de thème"
  >
    {#if $theme === 'dark'}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        ><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" /><path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        /></svg
      >
    {:else}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        ><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg
      >
    {/if}
  </button>
</header>

<!-- Bottom nav mobile -->
<nav
  class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-light-surface/90 dark:bg-app-surface/90 backdrop-blur-xl border-t border-light-border dark:border-app-border flex items-center justify-around px-2 z-20"
>
  {#each items as item, i (item.key)}
    {#if i === 1}
      <button
        class="flex flex-col items-center gap-1 -mt-3"
        onclick={() => currentView.set({ name: 'add' })}
      >
        <div class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/40">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            ><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg
          >
        </div>
        <span class="text-[10px] font-medium text-slate-400">Ajout</span>
      </button>
    {/if}
    <button class={bottomItemClass(item.key)} onclick={() => currentView.set({ name: item.key })}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        ><path d={iconFor(item.key)} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
      >
      <span class="text-[10px] font-medium">{item.label}</span>
    </button>
  {/each}
</nav>
