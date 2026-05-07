import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryAnalysisPage } from './QueryAnalysisPage';
import {
  fetchDashboard,
  fetchDetailRecords,
  fetchQueryDefectReasons,
  fetchQueryProductionLines
} from './query-api';

const chartDisposeMock = vi.fn();
const chartResizeMock = vi.fn();
const chartSetOptionMock = vi.fn();

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: chartSetOptionMock,
    resize: chartResizeMock,
    dispose: chartDisposeMock
  }))
}));

vi.mock('./query-api', () => ({
  fetchDashboard: vi.fn(),
  fetchDetailRecords: vi.fn(),
  fetchQueryDefectReasons: vi.fn(),
  fetchQueryProductionLines: vi.fn()
}));

const fetchDashboardMock = vi.mocked(fetchDashboard);
const fetchDetailRecordsMock = vi.mocked(fetchDetailRecords);
const fetchQueryDefectReasonsMock = vi.mocked(fetchQueryDefectReasons);
const fetchQueryProductionLinesMock = vi.mocked(fetchQueryProductionLines);

describe('QueryAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chartSetOptionMock.mockClear();
    chartResizeMock.mockClear();
    chartDisposeMock.mockClear();

    fetchQueryProductionLinesMock.mockResolvedValue([
      { id: 'line-1', code: 'LINE-01', name: '一号线' },
      { id: 'line-2', code: 'LINE-02', name: '二号线' }
    ]);
    fetchQueryDefectReasonsMock.mockResolvedValue([
      { id: 'reason-1', code: 'SCRATCH', name: '划伤' }
    ]);
    fetchDashboardMock.mockResolvedValue({
      period: {
        year: 2026,
        month: 5,
        startUtc: '2026-04-30T16:00:00.000Z',
        endUtc: '2026-05-31T16:00:00.000Z'
      },
      workshopTotals: {
        total: 3,
        qualified: 2,
        unqualified: 1
      },
      productionLineTotals: [
        {
          productionLineId: 'line-1',
          productionLineCode: 'LINE-01',
          productionLineName: '一号线',
          total: 2,
          qualified: 1,
          unqualified: 1
        }
      ],
      productDistribution: [
        { partNumber: 'PN-A', total: 2 },
        { partNumber: 'PN-B', total: 1 }
      ],
      unqualifiedPartDistribution: [{ partNumber: 'PN-A', unqualified: 1 }]
    });
    fetchDetailRecordsMock.mockResolvedValue({
      limit: 200,
      records: [
        {
          id: 'record-1',
          scannedAt: '2026-05-20T08:00:00.000Z',
          productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
          barcode: 'DETAIL-NEWEST',
          vehicleModel: '车型-A',
          partNumber: 'PN-ALPHA',
          result: 'UNQUALIFIED',
          defectReasons: [{ id: 'reason-1', code: 'SCRATCH', name: '划伤' }],
          inspector: { id: 'user-1', username: 'inspector' }
        }
      ]
    });
  });

  it('renders dashboard totals, line totals, and ECharts regions', async () => {
    render(<QueryAnalysisPage />);

    expect(await screen.findByRole('heading', { name: '查询分析' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '统计看板' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '明细查询' })).toBeTruthy();
    expect(await screen.findByText('2026年5月')).toBeTruthy();
    const metrics = screen.getByLabelText('月度指标');
    expect(within(metrics).getByText('总产出')).toBeTruthy();
    expect(within(metrics).getByText('合格数')).toBeTruthy();
    expect(within(metrics).getByText('不合格数')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('LINE-01')).toBeTruthy();
    expect(screen.getByText('产品分布')).toBeTruthy();
    expect(screen.getByText('不合格零件分布')).toBeTruthy();

    await waitFor(() => {
      expect(chartSetOptionMock).toHaveBeenCalled();
    });
  });

  it('reloads dashboard data when the production-line filter changes', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.change(await screen.findByLabelText('产线筛选'), { target: { value: 'line-2' } });

    await waitFor(() => {
      expect(fetchDashboardMock).toHaveBeenLastCalledWith({ productionLineId: 'line-2' });
    });
  });

  it('opens the dashboard in a full-screen view and exits with Escape', async () => {
    render(<QueryAnalysisPage />);

    const dashboardRegion = await screen.findByRole('region', { name: '统计看板内容' });
    fireEvent.click(screen.getByRole('button', { name: '全屏看板' }));

    expect(dashboardRegion.className).toContain('query-section--fullscreen');
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(dashboardRegion.className).not.toContain('query-section--fullscreen');
    expect(screen.getByRole('button', { name: '全屏看板' })).toBeTruthy();
  });

  it('submits detail-query filters and renders all required result fields', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '明细查询' }));
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-05-31' } });
    fireEvent.change(screen.getByLabelText('产线'), { target: { value: 'line-1' } });
    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'DETAIL' } });
    fireEvent.change(screen.getByLabelText('零件号'), { target: { value: 'PN-ALPHA' } });
    fireEvent.change(screen.getByLabelText('结果'), { target: { value: 'UNQUALIFIED' } });
    fireEvent.change(screen.getByLabelText('缺陷原因'), { target: { value: 'reason-1' } });
    fireEvent.click(screen.getByRole('button', { name: /查询/ }));

    await waitFor(() => {
      expect(fetchDetailRecordsMock).toHaveBeenCalledWith({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        productionLineId: 'line-1',
        barcode: 'DETAIL',
        partNumber: 'PN-ALPHA',
        result: 'UNQUALIFIED',
        defectReasonId: 'reason-1'
      });
    });

    const table = await screen.findByRole('table', { name: '明细查询结果' });
    expect(within(table).getByText('扫码时间')).toBeTruthy();
    expect(within(table).getByText('产线')).toBeTruthy();
    expect(within(table).getByText('条码')).toBeTruthy();
    expect(within(table).getByText('车型')).toBeTruthy();
    expect(within(table).getByText('零件号')).toBeTruthy();
    expect(within(table).getByText('结果')).toBeTruthy();
    expect(within(table).getByText('缺陷原因')).toBeTruthy();
    expect(within(table).getByText('检验员')).toBeTruthy();
    expect(within(table).getByText('DETAIL-NEWEST')).toBeTruthy();
    expect(within(table).getByText('一号线')).toBeTruthy();
    expect(within(table).getByText('车型-A')).toBeTruthy();
    expect(within(table).getByText('PN-ALPHA')).toBeTruthy();
    expect(within(table).getByText('不合格')).toBeTruthy();
    expect(within(table).getByText('划伤')).toBeTruthy();
    expect(within(table).getByText('inspector')).toBeTruthy();
  });

  it('shows independent API error alerts for dashboard and detail query', async () => {
    fetchDashboardMock.mockRejectedValueOnce(new Error('dashboard failed'));
    fetchDetailRecordsMock.mockRejectedValueOnce(new Error('detail failed'));

    render(<QueryAnalysisPage />);

    expect(await screen.findByText('统计看板加载失败，请稍后重试')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '明细查询' }));
    fireEvent.click(screen.getByRole('button', { name: /查询/ }));

    expect(await screen.findByText('明细查询失败，请检查筛选条件后重试')).toBeTruthy();
  });
});
