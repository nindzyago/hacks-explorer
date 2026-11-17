<script lang="ts">
  import type { Clock } from '../core/clock';

  // Shows the time of the player clock. Until there is a scene (M1.2) this is the one thing on
  // the page that depends on clock time, so a screenshot can tell two moments apart.
  // Shown only in the dev server and in the e2e build (see App.svelte).
  const { clock }: { clock: Clock } = $props();
  let timeMs = $state(0);

  $effect(() => {
    timeMs = clock.now();
    return clock.subscribe((event) => {
      timeMs = event.timeMs;
    });
  });
</script>

<p data-testid="clock-readout">Часы плеера: {timeMs} мс</p>

<style>
  p {
    font-variant-numeric: tabular-nums;
  }
</style>
