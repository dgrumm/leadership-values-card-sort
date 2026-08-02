import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Landing } from './Landing';

afterEach(cleanup);

describe('Landing', () => {
  it('renders the Values Cards heading', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: 'Values Cards' })).toBeDefined();
  });

  it('renders Start and Join actions', () => {
    render(<Landing />);
    expect(screen.getByRole('link', { name: 'Start a session' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Join a session' })).toBeDefined();
  });
});
