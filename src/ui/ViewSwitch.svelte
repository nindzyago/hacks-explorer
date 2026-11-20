<script lang="ts">
  // «Схема / Последовательность» (M6.2): two buttons with aria-pressed, each runs `view.set` by
  // id (K13). Temporary place in the controls bar; M6.1 puts these tabs in the header of the
  // scene panel (design M6 §2), the component moves as it is.
  import type { View } from '../core/state';
  import type { Translate } from '../services/i18n/i18n';

  const {
    view,
    run,
    t,
  }: {
    view: View;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();

  const set = (next: View) => {
    if (view !== next) run('view.set', { view: next });
  };
</script>

<div class="views" role="group" aria-label={t('view.label')} data-testid="view-switch">
  <button
    type="button"
    data-testid="view-scene"
    aria-pressed={view === 'scene'}
    onclick={() => {
      set('scene');
    }}>{t('view.scene')}</button
  >
  <button
    type="button"
    data-testid="view-sequence"
    aria-pressed={view === 'sequence'}
    onclick={() => {
      set('sequence');
    }}>{t('view.sequence')}</button
  >
</div>

<style>
  .views {
    box-sizing: border-box;
    display: inline-flex;
    align-self: center;
    flex: none;
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
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--legit);
    color: var(--panel);
  }

  @media (max-width: 760px) {
    .views {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
