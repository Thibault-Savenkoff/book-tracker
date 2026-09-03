<script lang="ts">
  import { supabase } from '../supabase'
  import { theme, toggleTheme } from '../theme'
  import { authLinkError } from '../auth'

  let email = $state('')
  let password = $state('')
  let signingIn = $state(false)
  // Une erreur de lien expiré est présente dès l'arrivée : elle sert d'état initial, puis toute
  // action de l'utilisateur la remplace.
  let error = $state<string | null>($authLinkError)
  let resetSent = $state(false)

  async function signIn() {
    error = null
    authLinkError.set(null)
    signingIn = true
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    signingIn = false
    if (err) error = err.message
  }

  async function sendPasswordReset() {
    if (!email) {
      error = 'Renseigne ton email pour recevoir le lien de réinitialisation.'
      return
    }
    error = null
    authLinkError.set(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (err) {
      error = err.message
      return
    }
    resetSent = true
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

  <div class="w-full max-w-sm bg-light-surface dark:bg-app-surface border border-light-border dark:border-app-border rounded-2xl shadow-2xl p-8 flex flex-col gap-7">
    <div class="flex flex-col items-center text-center gap-3">
      <div
        class="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          ><path
            d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5v-13z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          /><path d="M9 8.5l1.5 1.5L13 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </div>
      <div>
        <h1 class="font-serif text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Biblio<span class="italic text-indigo-600 dark:text-indigo-400">Log</span>
        </h1>
        <span class="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">Catalogue & suivi de lecture</span>
      </div>
    </div>

    {#if resetSent}
      <div class="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
        <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
        <p class="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
          Lien de réinitialisation envoyé à <strong class="font-semibold">{email}</strong>, vérifie ta boîte mail.
        </p>
      </div>
    {:else}
      <form
        class="flex flex-col gap-4"
        onsubmit={(e) => {
          e.preventDefault()
          signIn()
        }}
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Email</span>
          <input
            type="email"
            placeholder="ton@email.com"
            bind:value={email}
            required
            class="bg-slate-100 dark:bg-app-card border border-light-border dark:border-app-border rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Mot de passe</span>
          <input
            type="password"
            placeholder="••••••••"
            bind:value={password}
            required
            class="bg-slate-100 dark:bg-app-card border border-light-border dark:border-app-border rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </label>
        <button
          type="submit"
          disabled={signingIn}
          class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-60"
        >
          {signingIn ? 'Connexion…' : 'Se connecter'}
        </button>
        {#if error}<p class="text-red-500 text-xs text-center">{error}</p>{/if}
        <button type="button" class="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-center underline" onclick={sendPasswordReset}>
          Mot de passe oublié ?
        </button>
      </form>
      <div class="flex items-center gap-2.5 px-1 text-slate-400 justify-center">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path d="M12 3v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path
            d="M7 8l5-5 5 5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><rect x="5" y="14" width="14" height="7" rx="2" stroke="currentColor" stroke-width="2" /></svg
        >
        <span class="text-[10.5px] leading-tight">Installe BiblioLog sur ton écran d'accueil.</span>
      </div>
    {/if}
  </div>
</div>
