<script lang="ts">
  // Vignette de repli quand une source ne fournit aucune couverture : garder le titre lisible
  // vaut mieux qu'un rectangle vide dans une grille de couvertures.
  let { title }: { title: string } = $props()
</script>

<div class="w-full h-full bg-app-card dark:bg-app-card border border-light-border dark:border-app-border flex flex-col items-center justify-center gap-1.5 p-2">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-slate-500 flex-shrink-0"
    ><path
      d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    /></svg
  >
  <span class="font-serif text-[10px] font-semibold text-slate-200 text-center px-1 line-clamp-2">{title}</span>
</div>
