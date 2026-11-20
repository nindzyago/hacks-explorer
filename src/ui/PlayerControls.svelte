<script lang="ts">
  // Player controls (M1.3): every button runs a command by id (K13), like the keyboard and the
  // control channel. A button that can do nothing now is marked aria-disabled, not disabled, so
  // focus never drops to the page when the player reaches the end (S6: focus always visible).
  import { SPEEDS, stepCount, type PlayerState, type Speed } from '../core/player/player';
  import { formatNumber, type Translate } from '../services/i18n/i18n';

  const {
    player,
    run,
    t,
  }: {
    player: PlayerState;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();

  const count = $derived(stepCount(player));
  const atFirst = $derived(player.step <= 1);
  const atLast = $derived(count > 0 && player.step >= count);
  const speedText = (speed: Speed) => `${formatNumber(t, speed)}×`;
  const nextSpeed = $derived(SPEEDS[(SPEEDS.indexOf(player.speed) + 1) % SPEEDS.length] ?? 1);
</script>

<div
  class="controls"
  data-testid="player"
  data-player-keys
  role="group"
  aria-label={t('player.label')}
>
  <p class="status" data-testid="player-status">
    {count > 0
      ? t('player.status', { step: player.step, count })
      : t('player.statusUnknown', { step: player.step })}
  </p>
  <!-- M6.1: speed, back, play, step, restart — in the head of «Ход атаки» (design §2). -->
  <div class="buttons">
    <button
      type="button"
      class="speed"
      data-testid="player-speed"
      data-speed={player.speed}
      aria-label={t('player.speed', { speed: speedText(player.speed), next: speedText(nextSpeed) })}
      onclick={() => {
        run('player.speed', { value: nextSpeed });
      }}>{speedText(player.speed)}</button
    >
    <button
      type="button"
      class="icon"
      data-testid="player-back"
      aria-label={t('player.back')}
      aria-disabled={atFirst}
      onclick={() => {
        run('player.back');
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" /></svg>
    </button>
    <button
      type="button"
      class="play"
      data-testid="player-play"
      data-playing={player.playing}
      onclick={() => {
        run(player.playing ? 'player.pause' : 'player.play');
      }}
    >
      {#if player.playing}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 V19 M16 5 V19" /></svg>
        {t('player.pause')}
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path class="fill" d="M8 5 L19 12 L8 19 Z" /></svg
        >
        {t('player.play')}
      {/if}
    </button>
    <button
      type="button"
      data-testid="player-next"
      aria-label={t('player.next')}
      aria-disabled={atLast}
      onclick={() => {
        run('player.step');
      }}
    >
      <span class="label">{t('player.nextShort')}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" /></svg>
    </button>
    <button
      type="button"
      class="icon"
      data-testid="player-restart"
      aria-label={t('player.restart')}
      onclick={() => {
        run('player.goto', { step: 1 });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M5 12 A7 7 0 1 0 8 6.3 M8 2.5 V6.5 H4" /></svg
      >
    </button>
  </div>
</div>

<style>
  /* M6.1: blueprint buttons in the head of «Ход атаки»; on a phone a panel under the scene. */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2) var(--space-3);
  }

  /* The step number is said by the explanation and the table; screen readers still hear it. */
  .status {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  button {
    box-sizing: border-box;
    min-width: var(--target);
    min-height: var(--target);
    padding: 0 var(--space-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    border: var(--frame-width) solid var(--frame);
    border-radius: var(--radius-xs);
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

  button:hover {
    background: var(--paper);
  }

  button.icon {
    padding: 0;
  }

  button.play {
    min-width: 7rem;
    background: var(--legit);
    color: var(--panel);
  }

  button[aria-disabled='true'] {
    border-color: var(--line);
    color: var(--muted);
    cursor: default;
  }

  .speed {
    min-width: 3.5rem;
  }

  svg {
    width: 18px;
    height: 18px;
    flex: none;
  }

  path {
    fill: none;
    stroke: currentcolor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  path.fill {
    fill: currentcolor;
  }

  /* Phone (S10): the step number in words, then the five buttons in one row. */
  @media (max-width: 760px) {
    .controls {
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
    }

    .status {
      position: static;
      width: auto;
      height: auto;
      margin: 0;
      overflow: visible;
      clip-path: none;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--ink);
    }

    .buttons {
      width: 100%;
      display: grid;
      grid-template-columns: auto 44px minmax(0, 1fr) auto 44px;
    }

    button.play {
      min-width: 0;
    }

    .speed {
      min-width: 3.25rem;
    }
  }

  /* Narrow phones (360–380 px): «Шаг» keeps only its arrow, so «Пауза» fits whole. */
  @media (max-width: 380px) {
    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    button {
      padding: 0 var(--space-2);
    }
  }
</style>
