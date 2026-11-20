<script lang="ts">
  // «Без защиты / С защитой» (M1.5, K76): two buttons with aria-pressed, each runs `defence.set`
  // by id (K13), like D on the keyboard (`defence.toggle`, K69). The button of the mode that is
  // on does nothing: pressing it would only start the step again. With the defence on, the
  // lesson's defence from its passport is named next to it, in a slot of its own that is always
  // there (fixed width, two lines, verifier M1.5): turning the defence on moves no button.
  import type { PlayerState } from '../core/player/player';
  import type { Translate } from '../services/i18n/i18n';

  const {
    player,
    defenceName,
    run,
    t,
  }: {
    player: PlayerState;
    defenceName: string | null;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();

  const set = (on: boolean) => {
    if (player.defence !== on) run('defence.set', { on });
  };
</script>

<div class="defence" data-testid="defence-toggle" data-defence={player.defence}>
  <div class="seg" role="group" aria-label={t('defence.mode')}>
    <button
      type="button"
      data-testid="defence-off"
      data-mode="attack"
      aria-pressed={!player.defence}
      onclick={() => {
        set(false);
      }}>{t('defence.off')}</button
    >
    <button
      type="button"
      data-testid="defence-on"
      data-mode="defence"
      aria-pressed={player.defence}
      onclick={() => {
        set(true);
      }}>{t('defence.on')}</button
    >
  </div>
  <div class="caption" data-testid="defence-caption">
    {#if player.defence && defenceName !== null && defenceName !== ''}
      <p class="name" data-testid="defence-name" title={t('defence.name', { name: defenceName })}>
        {t('defence.name', { name: defenceName })}
      </p>
    {:else if !player.defence}
      <p class="off">{t('defence.isOff')}</p>
    {/if}
  </div>
</div>

<style>
  /*
   * M6.1: in the head of the scene panel — the caption on the left, the two buttons as one
   * blueprint switch on the right: «Без защиты» filled red, «С защитой» filled green.
   */
  .defence {
    box-sizing: border-box;
    display: flex;
    flex-direction: row-reverse;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    min-width: 0;
  }

  .seg {
    display: inline-flex;
  }

  button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: var(--target);
    padding: 0 var(--space-3);
    border: var(--frame-width) solid var(--frame);
    background: var(--panel);
    color: var(--legit);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
  }

  button:first-child {
    border-radius: var(--radius-xs) 0 0 var(--radius-xs);
  }

  button:last-child {
    border-left: 0;
    border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  }

  button:hover {
    background: var(--paper);
  }

  button[aria-pressed='true'] {
    border-color: var(--attack);
    background: var(--attack);
    color: var(--panel);
  }

  button[data-mode='defence'][aria-pressed='true'] {
    border-color: var(--defence);
    background: var(--defence);
  }

  /* Fixed width and two lines, whatever is in it: the buttons never move (verifier M1.5). */
  .caption {
    flex: none;
    width: 11rem;
    min-height: calc(2 * 1.3 * var(--text-xs));
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
  }

  .caption p {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.3;
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
    color: var(--defence);
  }

  .off {
    color: var(--muted);
  }

  /* Phone (S10): the two buttons share the row, the caption under them. */
  @media (max-width: 760px) {
    .defence {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .caption {
      width: 100%;
      justify-content: flex-start;
      text-align: left;
    }

    .seg {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
