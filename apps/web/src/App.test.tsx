import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))
    );
  });

  it('renders the system title', () => {
    render(<App />);

    expect(screen.getByText('车间检验扫描统计系统')).toBeTruthy();
  });
});
