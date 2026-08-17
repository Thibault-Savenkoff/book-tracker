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
  <div class="blob" style="top:-15vw;left:-10vw;width:45vw;height:45vw;max-width:520px;max-height:520px;background:#8B8FFF;opacity:0.24;"></div>
  <div class="blob" style="bottom:-20vw;right:-15vw;width:45vw;height:45vw;max-width:520px;max-height:520px;background:#4FB8FF;opacity:0.2;"></div>
  <div class="blob" style="top:35%;left:60%;width:24vw;height:24vw;max-width:320px;max-height:320px;background:#E06BC4;opacity:0.08;"></div>

  <div class="login">
    <div class="hero">
      <div class="eyebrow">Carnet de lecture</div>
      <div class="wordmark">Biblio<br />Log.</div>
      <p class="tagline">Romans, BD, mangas, comics — toute ta bibliothèque, notée et commentée.</p>
    </div>

    {#if sent}
      <p class="sent">Lien envoyé à {email}, vérifie ta boîte mail.</p>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); sendMagicLink() }}>
        <div class="field glass">
          <input type="email" placeholder="ton@email.com" bind:value={email} required />
        </div>
        <button type="submit">Accéder à ma collection →</button>
        <div class="install-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            ><path d="M12 3v13" stroke="rgba(242, 242, 245,0.4)" stroke-width="2" stroke-linecap="round" /><path
              d="M7 8l5-5 5 5"
              stroke="rgba(242, 242, 245,0.4)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><rect x="5" y="14" width="14" height="7" rx="2" stroke="rgba(242, 242, 245,0.4)" stroke-width="2" /></svg
          >
          <span>Installe BiblioLog sur ton écran d'accueil.</span>
        </div>
        {#if error}<p class="error">{error}</p>{/if}
      </form>
    {/if}
  </div>
</div>

<style>
  .page {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 26px;
  }
  .login {
    position: relative;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }
  .hero {
    display: flex;
    flex-direction: column;
  }
  .hero .eyebrow {
    margin-bottom: 14px;
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 52px;
    line-height: 0.98;
    letter-spacing: -0.01em;
  }
  .tagline {
    margin-top: 18px;
    font-size: 14.5px;
    color: var(--text-dim);
    line-height: 1.6;
    max-width: 250px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .field {
    padding: 15px 18px;
    border-top-color: var(--glass-border-top);
  }
  .field input {
    width: 100%;
    border: none;
    background: none;
    outline: none;
    color: var(--text);
    font-size: 15px;
  }
  button[type='submit'] {
    width: 100%;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--text);
    color: var(--bg);
    font-weight: 700;
    font-size: 15px;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
  }
  .install-hint {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 6px;
    padding: 2px 4px;
  }
  .install-hint span {
    font-size: 11.5px;
    color: var(--text-faint);
    line-height: 1.4;
  }
  .sent {
    font-size: 14px;
    color: var(--text-dim);
  }
  .error {
    color: var(--danger);
    font-size: 13px;
  }
</style>
