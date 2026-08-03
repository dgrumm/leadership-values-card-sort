/**
 * @values-cards/shared — pure TS: Zod schemas, game engine, contrast math.
 * No I/O, no DOM.
 */

export const SHARED_PACKAGE_NAME = '@values-cards/shared';

/** Placeholder export proving the workspace wiring end to end (00.1). */
export function greet(name: string): string {
  return `Values Cards says hello, ${name}`;
}

export * from './schemas/index.js';
export * from './engine/index.js';
