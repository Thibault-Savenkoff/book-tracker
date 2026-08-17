<script lang="ts">
  import { session, authLoading } from './lib/auth'
  import { currentView, NAV_SCREENS } from './lib/nav'
  import Login from './lib/views/Login.svelte'
  import Collection from './lib/views/Collection.svelte'
  import Planning from './lib/views/Planning.svelte'
  import Stats from './lib/views/Stats.svelte'
  import AddBook from './lib/views/AddBook.svelte'
  import BookDetail from './lib/views/BookDetail.svelte'
  import BottomNav from './lib/views/BottomNav.svelte'
  import Sidebar from './lib/views/Sidebar.svelte'

  const showNav = $derived(NAV_SCREENS.includes($currentView.name as (typeof NAV_SCREENS)[number]))
</script>

{#if $authLoading}
  <p class="loading">Chargement…</p>
{:else if !$session}
  <Login />
{:else}
  <div class="frame">
    <div class="shell">
      <Sidebar active={$currentView.name} />
      <div class="main">
        <div class="content">
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
        {#if showNav}
          <BottomNav active={$currentView.name as 'collection' | 'planning' | 'stats'} />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .frame {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100dvh;
    position: relative;
  }
  @media (min-width: 900px) {
    .frame {
      max-width: none;
    }
    .shell {
      flex-direction: row !important;
    }
    .main {
      flex: 1;
      min-width: 0;
    }
    .content {
      max-width: 1100px;
      margin: 0 auto;
    }
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    opacity: 0.6;
  }
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  .content {
    flex: 1 1 auto;
  }
</style>
