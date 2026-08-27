<script lang="ts">
  import { currentView } from '../nav'

  let { active }: { active: 'collection' | 'planning' | 'stats' | 'add' | 'book' } = $props()

  const items: { key: 'collection' | 'planning' | 'stats'; label: string }[] = [
    { key: 'collection', label: 'Collection' },
    { key: 'planning', label: 'Planning' },
    { key: 'stats', label: 'Statistiques' },
  ]
</script>

<header class="topnav">
  <div class="bar">
    <button class="wordmark" onclick={() => currentView.set({ name: 'collection' })}>
      Biblio<span>Log</span>
    </button>
    <nav>
      {#each items as item (item.key)}
        <button class="tab" class:on={active === item.key} onclick={() => currentView.set({ name: item.key })}>
          {item.label}
        </button>
      {/each}
    </nav>
    <button class="add" onclick={() => currentView.set({ name: 'add' })} aria-label="Ajouter un livre">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        ><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg
      >
      <span>Ajouter</span>
    </button>
  </div>
</header>

<style>
  .topnav {
    position: sticky;
    top: 0;
    z-index: 8;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
  }
  .bar {
    max-width: 920px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
  }
  .wordmark {
    border: none;
    background: none;
    padding: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 19px;
    color: var(--ink);
    letter-spacing: -0.01em;
    flex-shrink: 0;
  }
  .wordmark span {
    font-style: italic;
    color: var(--accent);
    font-weight: 500;
  }
  nav {
    flex: 1;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 0 6px;
  }
  @media (max-width: 560px) {
    nav {
      justify-content: flex-start;
    }
  }
  .tab {
    flex-shrink: 0;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    padding: 8px 10px 6px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .tab.on {
    border-bottom-color: var(--accent);
    color: var(--ink);
  }
  .add {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    padding: 9px 16px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 700;
  }
  .add span {
    display: none;
  }
  @media (min-width: 640px) {
    .add span {
      display: inline;
    }
  }
</style>
