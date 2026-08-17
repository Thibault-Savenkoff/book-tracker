<script lang="ts">
  import { currentView } from '../nav'

  let { active }: { active: 'collection' | 'planning' | 'stats' | 'add' | 'book' } = $props()

  const items: { key: 'collection' | 'planning' | 'stats' | 'add'; label: string; path: string; extra?: string }[] = [
    { key: 'collection', label: 'Collection', path: 'M4 4.5c2.7-1.3 5.6-1.3 8.5 0v15c-2.9-1.3-5.8-1.3-8.5 0v-15z', extra: 'M20.5 4.5c-2.7-1.3-5.6-1.3-8.5 0v15c2.9-1.3 5.8-1.3 8.5 0v-15z' },
    { key: 'planning', label: 'Planning', path: 'M3.5 9.5h17M8 3v4M16 3v4' },
    { key: 'stats', label: 'Statistiques', path: 'M4 20V10M12 20V4M20 20v-7' },
  ]
</script>

<div class="sidebar">
  <div class="wordmark">BiblioLog</div>
  {#each items as item (item.key)}
    <button class="item" class:on={active === item.key} onclick={() => currentView.set({ name: item.key })}>
      {#if item.key === 'planning'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.8" /><path
            d={item.path}
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          /></svg
        >
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          ><path d={item.path} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />{#if item.extra}<path
              d={item.extra}
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />{/if}</svg
        >
      {/if}
      {item.label}
    </button>
  {/each}
  <div class="spacer"></div>
  <button class="add" onclick={() => currentView.set({ name: 'add' })}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      ><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" /><path
        d="M21 21l-4.3-4.3"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      /></svg
    >
    Rechercher
  </button>
</div>

<style>
  .sidebar {
    display: none;
  }
  @media (min-width: 900px) {
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 230px;
      flex-shrink: 0;
      background: var(--bg-alt);
      border-right: 1px solid var(--glass-border);
      padding: 26px 16px;
      height: 100dvh;
      position: sticky;
      top: 0;
      align-self: flex-start;
    }
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 21px;
    letter-spacing: -0.01em;
    margin-bottom: 22px;
    padding-left: 8px;
    color: var(--accent);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 11px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 600;
    text-align: left;
  }
  .item.on {
    background: var(--glass-bg);
    color: var(--accent);
  }
  .spacer {
    height: 10px;
  }
  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 13px;
    font-weight: 700;
  }
</style>
