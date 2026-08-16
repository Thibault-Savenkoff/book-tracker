<script lang="ts">
  import { supabase } from '../supabase'

  let email = $state('')
  let sent = $state(false)
  let error = $state<string | null>(null)

  async function sendMagicLink() {
    error = null
    const { error: err } = await supabase.auth.signInWithOtp({ email })
    if (err) {
      error = err.message
      return
    }
    sent = true
  }
</script>

<div class="login">
  <h1>📚 Bibliothèque</h1>
  {#if sent}
    <p>Lien envoyé à {email}, vérifie ta boîte mail.</p>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); sendMagicLink() }}>
      <input type="email" placeholder="ton@email.com" bind:value={email} required />
      <button type="submit">Recevoir un lien de connexion</button>
    </form>
    {#if error}<p class="error">{error}</p>{/if}
  {/if}
</div>

<style>
  .login {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    gap: 1rem;
    padding: 1.5rem;
    text-align: center;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 320px;
  }
  input, button {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #444;
    font-size: 1rem;
  }
  button {
    background: #e8b84b;
    border: none;
    font-weight: 600;
    cursor: pointer;
  }
  .error {
    color: #ff6b6b;
  }
</style>
