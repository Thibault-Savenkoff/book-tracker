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

<div class="page">
  <div class="login">
    <div class="hero">
      <span class="eyebrow">Carnet de lecture</span>
      <h1 class="wordmark">Biblio<span>Log</span></h1>
      <p class="tagline">Romans, BD, mangas, comics — toute ta bibliothèque, notée et commentée.</p>
    </div>

    {#if sent}
      <p class="sent">Lien envoyé à <strong>{email}</strong>, vérifie ta boîte mail.</p>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); sendMagicLink() }}>
        <label class="field">
          <span>Email</span>
          <input type="email" placeholder="ton@email.com" bind:value={email} required />
        </label>
        <button type="submit">Accéder à ma collection<span aria-hidden="true">→</span></button>
        {#if error}<p class="error">{error}</p>{/if}
      </form>
      <div class="install-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          ><path d="M12 3v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path
            d="M7 8l5-5 5 5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><rect x="5" y="14" width="14" height="7" rx="2" stroke="currentColor" stroke-width="2" /></svg
        >
        <span>Installe BiblioLog sur ton écran d'accueil.</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 26px;
    background:
      radial-gradient(60% 50% at 15% 0%, var(--paper-alt), transparent 70%),
      var(--paper);
  }
  .login {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 36px;
  }
  .hero {
    display: flex;
    flex-direction: column;
  }
  .hero .eyebrow {
    margin-bottom: 16px;
  }
  .wordmark {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 54px;
    line-height: 0.98;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .wordmark span {
    font-style: italic;
    color: var(--accent);
    font-weight: 500;
  }
  .tagline {
    margin-top: 20px;
    font-size: 14.5px;
    color: var(--ink-dim);
    line-height: 1.6;
    max-width: 260px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .field input {
    padding: 12px 2px;
    border: none;
    border-bottom: 1.5px solid var(--line-strong);
    background: none;
    outline: none;
    color: var(--ink);
    font-size: 16px;
  }
  .field input:focus {
    border-bottom-color: var(--accent);
  }
  button[type='submit'] {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    font-size: 15px;
    box-shadow: 0 12px 24px -8px rgba(201, 164, 76, 0.35);
  }
  .install-hint {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 2px 4px;
    color: var(--ink-faint);
  }
  .install-hint span {
    font-size: 11.5px;
    line-height: 1.4;
  }
  .sent {
    font-size: 14.5px;
    color: var(--ink-dim);
    line-height: 1.6;
  }
  .error {
    color: var(--danger);
    font-size: 13px;
  }
</style>
