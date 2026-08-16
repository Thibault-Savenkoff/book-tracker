<script lang="ts">
  import { session, authLoading } from './lib/auth'
  import { currentView } from './lib/nav'
  import Login from './lib/views/Login.svelte'
  import Library from './lib/views/Library.svelte'
  import AddBook from './lib/views/AddBook.svelte'
  import BookDetail from './lib/views/BookDetail.svelte'
</script>

{#if $authLoading}
  <p class="loading">Chargement…</p>
{:else if !$session}
  <Login />
{:else if $currentView.name === 'library'}
  <Library />
{:else if $currentView.name === 'add'}
  <AddBook />
{:else if $currentView.name === 'book'}
  <BookDetail id={$currentView.id} />
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    opacity: 0.6;
  }
</style>
