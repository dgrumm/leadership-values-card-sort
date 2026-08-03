import { GameConfigSchema, type GameConfig } from '../schemas/config.js';

export type ConfigErrorCode =
  | 'INVALID_ROUND_COUNT'
  | 'KEEP_NOT_STRICTLY_DECREASING'
  | 'KEEP_EXCEEDS_DECK_SIZE'
  | 'ANY_OUTSIDE_FIRST_ROUND'
  | 'RANK_OUTSIDE_FINAL_ROUND'
  | 'SCHEMA_INVALID';

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  path: (string | number)[];
}

export type ValidateConfigResult = { ok: true; config: GameConfig } | { ok: false; errors: ConfigError[] };

/** Validates + applies the cross-field refinements encoded on GameConfigSchema. */
export function validateConfig(input: unknown): ValidateConfigResult {
  const result = GameConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, config: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const params = (issue as { params?: Record<string, unknown> }).params;
      const code = params?.code;
      return {
        code: typeof code === 'string' ? (code as ConfigErrorCode) : 'SCHEMA_INVALID',
        message: issue.message,
        path: issue.path as (string | number)[],
      };
    }),
  };
}
