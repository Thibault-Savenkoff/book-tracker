<script lang="ts">
  import { supabase } from '../supabase'
  import { passwordRecovery } from '../auth'
  import { theme, toggleTheme } from '../theme'

  let password = $state('')
  let saving = $state(false)
  let error = $state<string | null>(null)

  async function updatePassword() {
    error = null
    saving = true
    const { error: err } = await supabase.auth.updateUser({ password })
    saving = false
    if (err) {
      error = err.message
      return
    }
    passwordRecovery.set(false)
  }
</script>

<div class="min-h-dvh flex items-center justify-center bg-light-bg dark:bg-app-bg px-4 relative transition-colors">
  <button
    onclick={toggleTheme}
    class="absolute top-5 right-5 p-2 rounded-lg bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
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

  <div class="w-full max-w-sm bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
    <div>
      <span class="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Réinitialisation</span>
      <h1 class="font-serif text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Nouveau mot de passe</h1>
    </div>

    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => {
        e.preventDefault()
        updatePassword()
      }}
    >
      <label class="flex flex-col gap-1.5">
        <span class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Mot de passe</span>
        <input
          type="password"
          placeholder="••••••••"
          bind:value={password}
          required
          minlength="6"
          class="bg-slate-100 dark:bg-app-card border border-light-border dark:border-app-border rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-60"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
      </button>
      {#if error}<p class="text-red-500 text-xs text-center">{error}</p>{/if}
    </form>
  </div>
</div>
