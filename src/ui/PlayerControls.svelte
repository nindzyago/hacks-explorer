<script lang="ts">
  // Player controls (M1.3): every button runs a command by id (K13), like the keyboard and the
  // control channel. A button that can do nothing now is marked aria-disabled, not disabled, so
  // focus never drops to the page when the player reaches the end (S6: focus always visible).
  import { SPEEDS, stepCount, type PlayerState, type Speed } from '../core/player/player';

  const {
    player,
    run,
  }: {
    player: PlayerState;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
  } = $props();

  const count = $derived(stepCount(player));
  const atFirst = $derived(player.step <= 1);
  const atLast = $derived(count > 0 && player.step >= count);
  const speedText = (speed: Speed) => `${String(speed).replace('.', ',')}×`;
  const nextSpeed = $derived(SPEEDS[(SPEEDS.indexOf(player.speed) + 1) % SPEEDS.length] ?? 1);
</script>

<div
  class="controls"
  data-testid="player"
  data-player-keys
  role="group"
  aria-label="Управление уроком"
>
  <p class="status" data-testid="player-status">
    <span>Шаг {player.step}{count > 0 ? ` из ${String(count)}` : ''}</span>
    <span class="mode" data-testid="player-mode" data-defence={player.defence}
      >{player.defence ? 'С защитой' : 'Без защиты'}</span
    >
  </p>
  <div class="buttons">
    <button
      type="button"
      class="icon"
      data-testid="player-back"
      aria-label="Шаг назад"
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
        Пауза
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path class="fill" d="M8 5 L19 12 L8 19 Z" /></svg
        >
        Пуск
      {/if}
    </button>
    <button
      type="button"
      data-testid="player-next"
      aria-label="Шаг вперёд"
      aria-disabled={atLast}
      onclick={() => {
        run('player.step');
      }}
    >
      <span class="label">Шаг</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" /></svg>
    </button>
    <button
      type="button"
      class="icon"
      data-testid="player-restart"
      aria-label="Сначала"
      onclick={() => {
        run('player.goto', { step: 1 });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M5 12 A7 7 0 1 0 8 6.3 M8 2.5 V6.5 H4" /></svg
      >
    </button>
    <button
      type="button"
      class="speed"
      data-testid="player-speed"
      data-speed={player.speed}
      aria-label="Скорость {speedText(player.speed)}, нажать — {speedText(nextSpeed)}"
      onclick={() => {
        run('player.speed', { value: nextSpeed });
      }}>{speedText(player.speed)}</button
    >
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--panel);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
  }

  .status {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    align-items: baseline;
    font-weight: 700;
  }

  .mode {
    font-weight: 400;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .mode[data-defence='true'] {
    color: var(--scene-message-safe);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  button.icon {
    padding: 0;
  }

  button.play {
    min-width: 7rem;
    background: var(--ink);
    border-color: var(--ink);
    color: var(--panel);
    font-weight: 700;
  }

  button[aria-disabled='true'] {
    color: var(--muted);
    cursor: default;
  }

  .speed {
    font-family: var(--font-mono);
    min-width: 4rem;
  }

  svg {
    width: 20px;
    height: 20px;
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

  /* Phone (S10): the five buttons share one row; play takes the room that is left. */
  @media (max-width: 760px) {
    .buttons {
      width: 100%;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto 44px auto;
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
