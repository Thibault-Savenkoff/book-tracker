<script lang="ts">
  import { supabase } from '../supabase'

  let email = $state('')
  let sent = $state(false)
  let error = $state<string | null>(null)

  async function sendMagicLink() {
    error = null
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (err) {
      error = err.message
      return
    }
    sent = true
  }
</script>

<div class="min-h-dvh flex items-center justify-center px-6 py-10 bg-light-bg dark:bg-app-bg transition-colors">
  <div class="w-full max-w-sm flex flex-col gap-9">
    <div>
      <span class="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Carnet de lecture</span>
      <h1 class="font-serif text-6xl leading-none tracking-tight text-slate-900 dark:text-white mt-4">
        Biblio<span class="italic text-indigo-600 dark:text-indigo-400">Log</span>
      </h1>
      <p class="mt-5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px]">
        Romans, BD, mangas, comics — toute ta bibliothèque, notée et commentée.
      </p>
    </div>

    {#if sent}
      <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        Lien envoyé à <strong class="text-slate-900 dark:text-white">{email}</strong>, vérifie ta boîte mail.
      </p>
    {:else}
      <form
        class="flex flex-col gap-5"
        onsubmit={(e) => {
          e.preventDefault()
          sendMagicLink()
        }}
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email</span>
          <input
            type="email"
            placeholder="ton@email.com"
            bind:value={email}
            required
            class="py-3 border-0 border-b-[1.5px] border-slate-300 dark:border-white/15 bg-transparent outline-none text-slate-900 dark:text-white text-base focus:border-indigo-500 transition-colors"
          />
        </label>
        <button
          type="submit"
          class="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-none bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
        >
          Accéder à ma collection<span aria-hidden="true">→</span>
        </button>
        {#if error}<p class="text-red-500 text-sm">{error}</p>{/if}
      </form>
      <div class="flex items-center gap-2.5 px-1 text-slate-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          ><path d="M12 3v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path
            d="M7 8l5-5 5 5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><rect x="5" y="14" width="14" height="7" rx="2" stroke="currentColor" stroke-width="2" /></svg
        >
        <span class="text-[11.5px] leading-tight">Installe BiblioLog sur ton écran d'accueil.</span>
      </div>
    {/if}
  </div>
</div>
