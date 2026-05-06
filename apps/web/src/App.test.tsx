import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the system title', () => {
    render(<App />);

    expect(screen.getByText('车间检验扫描统计系统')).toBeTruthy();
  });
});
