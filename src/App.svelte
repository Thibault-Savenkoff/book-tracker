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
  <div class="h-dvh flex items-center justify-center bg-light-bg dark:bg-app-bg">
    <p class="font-serif italic text-slate-400">Chargement…</p>
  </div>
{:else if !$session}
  <Login />
{:else}
  <div class="h-dvh w-full flex flex-col md:flex-row overflow-hidden bg-light-bg dark:bg-app-bg transition-colors">
    <TopNav active={$currentView.name} />
    <main class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto thin-scrollbar pb-20 md:pb-0">
        <div class="max-w-5xl mx-auto w-full">
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
        </div>
      </div>
    </main>
  </div>
{/if}
