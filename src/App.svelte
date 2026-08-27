<script lang="ts">
  import { session, authLoading } from './lib/auth'
  import { currentView } from './lib/nav'
  import Login from './lib/views/Login.svelte'
  import Collection from './lib/views/Collection.svelte'
  import Planning from './lib/views/Planning.svelte'
  import Stats from './lib/views/Stats.svelte'
  import AddBook from './lib/views/AddBook.svelte'
  import BookDetail from './lib/views/BookDetail.svelte'
  import TopNav from './lib/views/TopNav.svelte'
</script>

{#if $authLoading}
  <p class="loading">Chargement…</p>
{:else if !$session}
  <Login />
{:else}
  <div class="app">
    <TopNav active={$currentView.name} />
    <main>
      {#if $currentView.name === 'collection'}
        <Collection />
      {:else if $currentView.name === 'planning'}
        <Planning />
      {:else if $currentView.name === 'stats'}
        <Stats />
      {:else if $currentView.name === 'add'}
        <AddBook initialQuery={$currentView.query} />
      {:else if $currentView.name === 'book'}
        <BookDetail id={$currentView.id} />
      {/if}
    </main>
  </div>
{/if}

<style>
  .app {
    min-height: 100dvh;
  }
  main {
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    color: var(--ink-faint);
    font-family: var(--font-display);
    font-style: italic;
  }
</style>
