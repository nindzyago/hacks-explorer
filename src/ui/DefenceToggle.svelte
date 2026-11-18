<script lang="ts">
  // «Без защиты / С защитой» (M1.5, K76): two buttons with aria-pressed, each runs `defence.set`
  // by id (K13), like D on the keyboard (`defence.toggle`, K69). The button of the mode that is
  // on does nothing: pressing it would only start the step again. With the defence on, the
  // lesson's defence from its passport is named next to it, in a slot of its own that is always
  // there (fixed width, two lines, verifier M1.5): turning the defence on moves no button.
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
  <div class="caption" data-testid="defence-caption">
    {#if player.defence && defenceName !== null && defenceName !== ''}
      <p class="name" data-testid="defence-name" title="Защита: {defenceName}">
        Защита: {defenceName}
      </p>
    {:else if !player.defence}
      <p class="off">Защита выключена</p>
    {/if}
  </div>
</div>

<style>
  .defence {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    flex: none;
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
  }

  button[data-mode='defence'][aria-pressed='true'] {
    background: var(--scene-message-safe);
    color: var(--scene-message-text);
  }

  /* Fixed width and two lines, whatever is in it: the buttons never move (verifier M1.5). */
  .caption {
    flex: none;
    width: 12.5rem;
    min-height: calc(2 * 1.35 * var(--text-sm));
    display: flex;
    align-items: center;
  }

  .caption p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.35;
    min-width: 0;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .name {
    font-weight: 700;
    color: var(--scene-message-safe);
  }

  .off {
    color: var(--muted);
  }

  /* Phone (S10): the two buttons share the row. */
  @media (max-width: 760px) {
    .defence {
      width: 100%;
    }

    .caption {
      width: 100%;
    }

    .seg {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
