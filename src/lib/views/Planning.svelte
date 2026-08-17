<script lang="ts"></script>

<div class="page">
  <div class="header">
    <div class="eyebrow">Prochaines sorties</div>
    <div class="page-title">Planning</div>
  </div>

  <div class="empty glass">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      ><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="rgba(242, 242, 245,0.4)" stroke-width="1.8" /><path
        d="M3.5 9.5h17M8 3v4M16 3v4"
        stroke="rgba(242, 242, 245,0.4)"
        stroke-width="1.8"
        stroke-linecap="round"
      /></svg
    >
    <p>Bientôt disponible.</p>
    <p class="sub">Cet écran affichera les sorties à venir dans tes catégories préférées, une fois qu'on aura choisi une source de données fiable (Google Books ou un flux spécialisé).</p>
  </div>
</div>

<style>
  .page {
    padding-bottom: 24px;
  }
  .header {
    padding: 58px 22px 16px;
  }
  .empty {
    margin: 20px 22px;
    padding: 40px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .empty p {
    margin: 0;
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
  }
  .empty p.sub {
    color: var(--text-faint);
    font-size: 12.5px;
    font-weight: 400;
    line-height: 1.6;
    max-width: 280px;
  }
</style>
