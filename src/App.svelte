<script lang="ts">
  import { session, authLoading, passwordRecovery } from './lib/auth'
  import { currentView } from './lib/nav'
  import Login from './lib/views/Login.svelte'
  import ResetPassword from './lib/views/ResetPassword.svelte'
  import Collection from './lib/views/Collection.svelte'
  import Planning from './lib/views/Planning.svelte'
  import Stats from './lib/views/Stats.svelte'
  import AddBook from './lib/views/AddBook.svelte'
  import BookDetail from './lib/views/BookDetail.svelte'
  import TopNav from './lib/views/TopNav.svelte'
  import Header from './lib/views/Header.svelte'
</script>

{#if $authLoading}
  <div class="h-dvh flex items-center justify-center bg-light-bg dark:bg-app-bg">
    <p class="font-serif italic text-slate-400">Chargement…</p>
  </div>
{:else if $passwordRecovery}
  <ResetPassword />
{:else if !$session}
  <Login />
{:else}
  <div class="h-dvh w-full flex overflow-hidden bg-light-bg dark:bg-app-bg transition-colors">
    <TopNav active={$currentView.name} />
    <main class="flex-1 flex flex-col h-full overflow-hidden">
      <Header />
      <div class="flex-1 overflow-y-auto thin-scrollbar pb-24 md:pb-8">
        {#if $currentView.name === 'planning'}
          <Planning />
        {:else if $currentView.name === 'stats'}
          <Stats />
        {:else if $currentView.name === 'add'}
          <AddBook initialQuery={$currentView.query} />
        {:else}
          <Collection />
        {/if}
      </div>
      {#if $currentView.name === 'book'}
        <BookDetail id={$currentView.id} />
      {/if}
    </main>
  </div>
{/if}
