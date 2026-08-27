<script lang="ts">
  import { currentView } from '../nav'
  import { theme, toggleTheme } from '../theme'
  import { searchQuery } from '../collectionFilter'
</script>

<header
  class="h-16 px-4 md:px-8 border-b border-light-border dark:border-app-border flex items-center justify-between gap-4 bg-light-surface/90 dark:bg-app-bg/80 backdrop-blur-md z-10 transition-colors flex-shrink-0"
>
  <!-- Barre de recherche -->
  <div class="relative flex-1 max-w-md">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
      ><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
    >
    <input
      type="text"
      placeholder="Filtrer par titre, auteur…"
      bind:value={$searchQuery}
      class="w-full bg-slate-100 dark:bg-app-surface border border-light-border dark:border-app-border focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none transition"
    />
  </div>

  <!-- Contrôles : Bouton Theme Switcher + Ajout -->
  <div class="flex items-center gap-3">
    <button
      onclick={toggleTheme}
      class="p-2 rounded-lg bg-slate-100 dark:bg-app-surface border border-light-border dark:border-app-border text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
      title="Basculer Mode Clair / Sombre"
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

    <button
      onclick={() => currentView.set({ name: 'add' })}
      class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-md shadow-indigo-600/20"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
      <span class="hidden sm:inline">Ajouter</span>
    </button>
  </div>
</header>
