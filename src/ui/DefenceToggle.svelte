<script lang="ts">
  // «Без защиты / С защитой» (M1.5, K76): two buttons with aria-pressed, each runs `defence.set`
  // by id (K13), like D on the keyboard (`defence.toggle`, K69). The button of the mode that is
  // on does nothing: pressing it would only start the step again. With the defence on, the
  // lesson's defence from its passport is named next to it.
  import type { PlayerState } from '../core/player/player';

  const {
    player,
    defenceName,
    run,
  }: {
    player: PlayerState;
    defenceName: string | null;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
  } = $props();

  const set = (on: boolean) => {
    if (player.defence !== on) run('defence.set', { on });
  };
</script>

<div class="defence" data-testid="defence-toggle" data-defence={player.defence}>
  <div class="seg" role="group" aria-label="Режим урока">
    <button
      type="button"
      data-testid="defence-off"
      data-mode="attack"
      aria-pressed={!player.defence}
      onclick={() => {
        set(false);
      }}>Без защиты</button
    >
    <button
      type="button"
      data-testid="defence-on"
      data-mode="defence"
      aria-pressed={player.defence}
      onclick={() => {
        set(true);
      }}>С защитой</button
    >
  </div>
  {#if player.defence && defenceName !== null && defenceName !== ''}
    <p class="name" data-testid="defence-name">Защита: {defenceName}</p>
  {/if}
</div>

<style>
  .defence {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--panel);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
    min-width: 0;
  }

  .seg {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    background: var(--paper);
  }

  button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--panel);
    font-weight: 700;
  }

  button[data-mode='defence'][aria-pressed='true'] {
    background: var(--scene-message-safe);
    color: var(--scene-message-text);
  }

  .name {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--scene-message-safe);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Phone (S10): the two buttons share the row. */
  @media (max-width: 760px) {
    .defence {
      width: 100%;
    }

    .seg {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
