import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE_NAME, greet } from './index';

describe('shared placeholder', () => {
  it('exposes the package name', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@values-cards/shared');
  });

  it('greets by name', () => {
    expect(greet('Ada')).toBe('Values Cards says hello, Ada');
  });
});
