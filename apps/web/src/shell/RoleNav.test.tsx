import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleNav } from './RoleNav';

describe('RoleNav', () => {
  it('shows only inspection scanning for inspectors', () => {
    render(<RoleNav role="INSPECTOR" activeModule="inspection" onModuleChange={vi.fn()} />);

    expect(screen.getByText('检验扫描')).toBeTruthy();
    expect(screen.queryByText('查询分析')).toBeNull();
    expect(screen.queryByText('基础数据')).toBeNull();
  });

  it('shows only query analysis for query users', () => {
    render(<RoleNav role="QUERY" activeModule="query" onModuleChange={vi.fn()} />);

    expect(screen.queryByText('检验扫描')).toBeNull();
    expect(screen.getByText('查询分析')).toBeTruthy();
    expect(screen.queryByText('基础数据')).toBeNull();
  });

  it('shows all module placeholders for administrators', () => {
    render(<RoleNav role="ADMIN" activeModule="inspection" onModuleChange={vi.fn()} />);

    expect(screen.getByText('检验扫描')).toBeTruthy();
    expect(screen.getByText('查询分析')).toBeTruthy();
    expect(screen.getByText('基础数据')).toBeTruthy();
  });
});
