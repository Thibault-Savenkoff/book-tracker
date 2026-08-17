<script lang="ts">
  import { currentView } from '../nav'

  let { active }: { active: 'collection' | 'planning' | 'stats' } = $props()

  const items: { key: 'collection' | 'planning' | 'stats'; label: string; path: string }[] = [
    {
      key: 'collection',
      label: 'Collection',
      path: 'M4 4.5c2.7-1.3 5.6-1.3 8.5 0v15c-2.9-1.3-5.8-1.3-8.5 0v-15zM20.5 4.5c-2.7-1.3-5.6-1.3-8.5 0v15c2.9-1.3 5.8-1.3 8.5 0v-15z',
    },
    {
      key: 'planning',
      label: 'Planning',
      path: 'M3.5 9.5h17M8 3v4M16 3v4',
    },
    {
      key: 'stats',
      label: 'Stats',
      path: 'M4 20V10M12 20V4M20 20v-7',
    },
  ]
</script>

<div class="nav-wrap">
  <div class="nav glass">
    {#each items as item}
      <button
        class="item"
        class:on={active === item.key}
        onclick={() => currentView.set({ name: item.key })}
      >
        {#if item.key === 'planning'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            ><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke={active === item.key ? 'var(--accent)' : 'rgba(242, 242, 245,0.42)'} stroke-width="1.8" /><path
              d={item.path}
              stroke={active === item.key ? 'var(--accent)' : 'rgba(242, 242, 245,0.42)'}
              stroke-width="1.8"
              stroke-linecap="round"
            /></svg
          >
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            ><path
              d={item.path}
              stroke={active === item.key ? 'var(--accent)' : 'rgba(242, 242, 245,0.42)'}
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        {/if}
        {#if active === item.key}<span>{item.label}</span>{/if}
      </button>
      {#if item.key === 'planning'}
        <button class="add" onclick={() => currentView.set({ name: 'add' })} aria-label="Rechercher un livre">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            ><circle cx="11" cy="11" r="7" stroke="#fff" stroke-width="2.2" /><path
              d="M21 21l-4.3-4.3"
              stroke="#fff"
              stroke-width="2.2"
              stroke-linecap="round"
            /></svg
          >
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .nav-wrap {
    position: sticky;
    bottom: 0;
    z-index: 6;
    display: flex;
    justify-content: center;
    padding: 0 18px 26px;
    pointer-events: none;
  }
  @media (min-width: 900px) {
    .nav-wrap {
      display: none;
    }
  }
  .nav {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(24, 25, 30, 0.82);
    border-top-color: rgba(255, 255, 255, 0.22);
    border-radius: 32px;
    padding: 8px;
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.45);
  }
  .item {
    background: none;
    border: none;
    border-radius: 20px;
    width: 62px;
    height: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }
  .item span {
    font-size: 8px;
    color: var(--accent);
    font-weight: 600;
  }
  .add {
    background: var(--accent);
    border: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 3px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
</style>
