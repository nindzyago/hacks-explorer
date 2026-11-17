/**
 * Command registry (architecture §3): the interface, the keyboard, tests and the control channel
 * all act through `run(id, params)`. Behaviour and limits are described in README.md.
 */
import {
  checkParams,
  specProblems,
  type ParamProblem,
  type ParamsOf,
  type ParamsSpec,
} from './params';

export interface Command<State, S extends ParamsSpec> {
  /** `area.action`, for example `player.play`. */
  readonly id: string;
  /** Key of the human-readable name in the locale files; the registry holds no texts. */
  readonly titleKey: string;
  readonly params: S;
  /** Absent means always enabled. */
  readonly enabled?: (state: State) => boolean;
  /** Synchronous. Receives parameters that already passed validation. */
  readonly run: (params: ParamsOf<S>) => void;
}

/** One row of `list()`: plain data, safe to send through the control channel. */
export interface CommandInfo {
  readonly id: string;
  readonly titleKey: string;
  readonly params: ParamsSpec;
  readonly enabled: boolean;
}

export type RunErrorCode = 'unknown-command' | 'invalid-params' | 'disabled' | 'failed';

/** Plain data. `problems` is present only for `invalid-params`. */
export interface RunError {
  readonly code: RunErrorCode;
  /** The requested id, cut to 64 characters; '' when the id was not a string. */
  readonly commandId: string;
  readonly message: string;
  readonly problems?: readonly ParamProblem[];
}

export type RunResult = { readonly ok: true } | { readonly ok: false; readonly error: RunError };

export type DefinitionErrorCode = 'invalid-definition' | 'duplicate-id';

/** Thrown by `register`: a mistake in the code of a command, found at start-up and by the gate. */
export class CommandDefinitionError extends Error {
  readonly code: DefinitionErrorCode;
  readonly commandId: string;

  constructor(code: DefinitionErrorCode, commandId: string, message: string) {
    super(message);
    this.name = 'CommandDefinitionError';
    this.code = code;
    this.commandId = commandId;
  }
}

export interface CommandRegistry<State> {
  /** @throws {CommandDefinitionError} on a bad or duplicate definition; nothing is registered. */
  register<const S extends ParamsSpec>(command: Command<State, S>): void;
  /** Never throws. `id` and `params` may be anything. */
  run(id: unknown, params?: unknown): RunResult;
  /** Every command in registration order. */
  list(): CommandInfo[];
}

const COMMAND_ID = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;
const MAX_ID_LENGTH = 64;
const MAX_CAUSE_LENGTH = 200;

interface Entry {
  readonly id: string;
  readonly titleKey: string;
  readonly params: ParamsSpec;
  readonly isEnabled: () => boolean;
  readonly run: (raw: unknown) => RunResult;
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Total: a thrown value can be anything, including something that throws when printed. */
function causeOf(error: unknown): string {
  try {
    if (error instanceof Error) {
      const message: unknown = error.message;
      if (typeof message === 'string') return cut(message, MAX_CAUSE_LENGTH);
    }
    return cut(String(error), MAX_CAUSE_LENGTH);
  } catch {
    return 'unprintable error';
  }
}

function freezeSpec(spec: ParamsSpec): void {
  for (const paramSpec of Object.values(spec)) {
    if (paramSpec.kind === 'enum') Object.freeze(paramSpec.values);
    Object.freeze(paramSpec);
  }
  Object.freeze(spec);
}

export function createRegistry<State>(getState: () => State): CommandRegistry<State> {
  const entries = new Map<string, Entry>();

  function register<const S extends ParamsSpec>(command: Command<State, S>): void {
    const { id, titleKey, params: spec, enabled, run } = command;
    const shownId = cut(id, MAX_ID_LENGTH);
    if (!COMMAND_ID.test(id) || id.length > MAX_ID_LENGTH) {
      throw new CommandDefinitionError(
        'invalid-definition',
        shownId,
        `command id "${shownId}" must look like "area.action"`,
      );
    }
    if (entries.has(id)) {
      throw new CommandDefinitionError('duplicate-id', id, `command "${id}" is already registered`);
    }
    if (titleKey.trim() === '') {
      throw new CommandDefinitionError('invalid-definition', id, `command "${id}" has no titleKey`);
    }
    const problems = specProblems(spec);
    if (problems.length > 0) {
      throw new CommandDefinitionError(
        'invalid-definition',
        id,
        `command "${id}" has a bad parameter description: ${problems.join('; ')}`,
      );
    }
    freezeSpec(spec);

    const fail = (
      code: RunErrorCode,
      message: string,
      found?: readonly ParamProblem[],
    ): RunResult => ({
      ok: false,
      error:
        found === undefined
          ? { code, commandId: id, message }
          : { code, commandId: id, message, problems: found },
    });
    const isEnabled = () => {
      if (enabled === undefined) return true;
      const answer: unknown = enabled(getState());
      return answer === true;
    };

    entries.set(id, {
      id,
      titleKey,
      params: spec,
      isEnabled,
      run: (raw) => {
        const checked = checkParams(spec, raw);
        if (!checked.ok) {
          return fail('invalid-params', `command "${id}" got invalid parameters`, checked.problems);
        }
        try {
          if (!isEnabled()) {
            return fail('disabled', `command "${id}" is disabled in the current state`);
          }
          run(checked.params);
        } catch (error) {
          return fail('failed', `command "${id}" failed: ${causeOf(error)}`);
        }
        return { ok: true };
      },
    });
  }

  function run(id: unknown, params?: unknown): RunResult {
    if (typeof id !== 'string') {
      return {
        ok: false,
        error: { code: 'unknown-command', commandId: '', message: 'command id must be a string' },
      };
    }
    const entry = entries.get(id);
    if (entry === undefined) {
      const shownId = cut(id, MAX_ID_LENGTH);
      return {
        ok: false,
        error: {
          code: 'unknown-command',
          commandId: shownId,
          message: `unknown command "${shownId}"`,
        },
      };
    }
    return entry.run(params);
  }

  function list(): CommandInfo[] {
    return Array.from(entries.values(), (entry) => {
      let enabled = false;
      try {
        enabled = entry.isEnabled();
      } catch {
        // A broken enabled() must not hide the rest of the list; run() reports it as `failed`.
      }
      return { id: entry.id, titleKey: entry.titleKey, params: entry.params, enabled };
    });
  }

  return { register, run, list };
}
