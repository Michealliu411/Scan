import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryAnalysisPage } from './QueryAnalysisPage';
import { fetchDailyProductionPlans } from '../production-plan/production-plan-api';
import {
  fetchDashboard,
  fetchQualityDailyReport,
  fetchInspectionRecordChangeLogs,
  fetchDetailRecords,
  fetchQueryDefectReasons,
  fetchQueryProductionLines,
  reclassifyInspectionRecord,
  updateUnqualifiedRecordReasons
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
  fetchQualityDailyReport: vi.fn(),
  fetchInspectionRecordChangeLogs: vi.fn(),
  fetchDetailRecords: vi.fn(),
  fetchQueryDefectReasons: vi.fn(),
  fetchQueryProductionLines: vi.fn(),
  reclassifyInspectionRecord: vi.fn(),
  updateUnqualifiedRecordReasons: vi.fn()
}));

vi.mock('../production-plan/production-plan-api', () => ({
  fetchDailyProductionPlans: vi.fn()
}));

const fetchDashboardMock = vi.mocked(fetchDashboard);
const fetchQualityDailyReportMock = vi.mocked(fetchQualityDailyReport);
const fetchInspectionRecordChangeLogsMock = vi.mocked(fetchInspectionRecordChangeLogs);
const fetchDetailRecordsMock = vi.mocked(fetchDetailRecords);
const fetchQueryDefectReasonsMock = vi.mocked(fetchQueryDefectReasons);
const fetchQueryProductionLinesMock = vi.mocked(fetchQueryProductionLines);
const reclassifyInspectionRecordMock = vi.mocked(reclassifyInspectionRecord);
const updateUnqualifiedRecordReasonsMock = vi.mocked(updateUnqualifiedRecordReasons);
const fetchDailyProductionPlansMock = vi.mocked(fetchDailyProductionPlans);

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
    fetchQualityDailyReportMock.mockResolvedValue({
      period: {
        year: 2026,
        month: 5,
        startUtc: '2026-04-30T16:00:00.000Z',
        endUtc: '2026-05-31T16:00:00.000Z'
      },
      workshop: '缝纫',
      process: '缝纫',
      defectReasons: [
        { id: 'reason-a', code: 'A0', name: '错缝' },
        { id: 'reason-b', code: 'A1', name: '漏缝' }
      ],
      rows: [
        {
          businessDate: '2026-05-10',
          productionLineId: 'line-1',
          productionLineCode: 'LINE-01',
          productionLineName: '一号线',
          vehicleModel: '车型-日报',
          partName: '部件-日报',
          workshop: '缝纫',
          process: '缝纫',
          productionQuantity: 10,
          qualifiedQuantity: 8,
          unqualifiedQuantity: 2,
          qualifiedRate: 0.8,
          defectCounts: { 'reason-a': 2, 'reason-b': 0 }
        }
      ]
    });
    fetchDetailRecordsMock.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 2,
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
        },
        {
          id: 'record-qualified',
          scannedAt: '2026-05-20T09:00:00.000Z',
          productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
          barcode: 'DETAIL-QUALIFIED',
          vehicleModel: '车型-Q',
          partNumber: 'PN-Q',
          result: 'QUALIFIED',
          defectReasons: [],
          inspector: { id: 'user-1', username: 'inspector' }
        }
      ]
    });
    fetchInspectionRecordChangeLogsMock.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 1,
      logs: [
        {
          id: 'log-1',
          inspectionRecordId: 'record-qualified',
          module: 'inspection',
          action: 'RECLASSIFY_UNQUALIFIED',
          targetType: 'inspectionRecord',
          targetLabel: 'DETAIL-QUALIFIED',
          operatedAt: '2026-05-20T10:00:00.000Z',
          barcode: 'DETAIL-QUALIFIED',
          partNumber: 'PN-Q',
          previousResult: 'QUALIFIED',
          newResult: 'UNQUALIFIED',
          before: null,
          after: null,
          defectReasons: [{ id: 'reason-1', code: 'SCRATCH', name: '划伤' }],
          operator: { id: 'query-user', username: 'query' }
        }
      ]
    });
    reclassifyInspectionRecordMock.mockResolvedValue({
      id: 'record-qualified',
      scannedAt: '2026-05-20T09:00:00.000Z',
      productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
      barcode: 'DETAIL-QUALIFIED',
      vehicleModel: '车型-Q',
      partNumber: 'PN-Q',
      result: 'UNQUALIFIED',
      defectReasons: [{ id: 'reason-1', code: 'SCRATCH', name: '划伤' }],
      inspector: { id: 'user-1', username: 'inspector' }
    });
    updateUnqualifiedRecordReasonsMock.mockResolvedValue({
      id: 'record-1',
      scannedAt: '2026-05-20T08:00:00.000Z',
      productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
      barcode: 'DETAIL-NEWEST',
      vehicleModel: '车型-A',
      partNumber: 'PN-ALPHA',
      result: 'UNQUALIFIED',
      defectReasons: [{ id: 'reason-1', code: 'SCRATCH', name: '划伤' }],
      inspector: { id: 'user-1', username: 'inspector' }
    });
    fetchDailyProductionPlansMock.mockResolvedValue([
      {
        id: 'plan-1',
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-COMPLETE-001',
        partNumber: 'PN-COMPLETE',
        productName: '订单完成产品',
        orderQuantity: 100,
        plannedQuantity: 25,
        status: 'ACTIVE',
        closedAt: null,
        createdAt: '2026-06-05T01:00:00.000Z',
        updatedAt: '2026-06-05T01:00:00.000Z',
        createdByUsername: 'query',
        updatedByUsername: 'query',
        productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
        qualifiedCount: 20,
        unqualifiedCount: 1,
        remainingQuantity: 5,
        completionRate: 0.8,
        productionLines: [{ id: 'line-1', code: 'LINE-01', name: '一号线' }]
      }
    ]);
  });

  it('renders dashboard totals, line totals as a bar chart, and ECharts regions', async () => {
    render(<QueryAnalysisPage />);

    expect(await screen.findByRole('heading', { name: '查询分析' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '统计看板' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '订单完成' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '明细查询' })).toBeTruthy();
    expect(await screen.findByText('2026年5月')).toBeTruthy();
    const metrics = screen.getByLabelText('月度指标');
    expect(within(metrics).getByText('总产出')).toBeTruthy();
    expect(within(metrics).getByText('合格数')).toBeTruthy();
    expect(within(metrics).getByText('不合格数')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('产线统计')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '产线月度统计' })).toBeNull();
    expect(screen.getByText('产品分布')).toBeTruthy();
    expect(screen.getByText('不合格零件分布')).toBeTruthy();

    await waitFor(() => {
      expect(chartSetOptionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          legend: expect.objectContaining({
            data: ['总产出', '合格数', '不合格数'],
            bottom: 0
          }),
          grid: expect.objectContaining({
            bottom: 64
          }),
          xAxis: expect.objectContaining({
            data: ['LINE-01']
          }),
          series: [
            expect.objectContaining({ name: '总产出', type: 'bar', data: [2] }),
            expect.objectContaining({ name: '合格数', type: 'bar', data: [1] }),
            expect.objectContaining({ name: '不合格数', type: 'bar', data: [1] })
          ]
        })
      );
    });
  });

  it('reloads dashboard data when the production-line filter changes', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.change(await screen.findByLabelText('产线筛选'), { target: { value: 'line-2' } });

    await waitFor(() => {
      expect(fetchDashboardMock).toHaveBeenLastCalledWith({ productionLineId: 'line-2' });
    });
  });

  it('queries and renders the quality daily report with dynamic defect columns', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '质量日报' }));
    fireEvent.change(screen.getByLabelText('年份'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('月份'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('产线'), { target: { value: 'line-1' } });
    fireEvent.click(screen.getByRole('button', { name: '查询日报' }));

    await waitFor(() => {
      expect(fetchQualityDailyReportMock).toHaveBeenLastCalledWith({
        year: 2026,
        month: 5,
        productionLineId: 'line-1'
      });
    });

    const table = await screen.findByRole('table', { name: '生产质量日报' });
    expect(within(table).getByText('部件')).toBeTruthy();
    expect(within(table).getByText('A0 错缝')).toBeTruthy();
    expect(within(table).getByText('A1 漏缝')).toBeTruthy();
    expect(within(table).getByText('部件-日报')).toBeTruthy();
    expect(within(table).getByText('80%')).toBeTruthy();
    expect(screen.getByRole('button', { name: '导出 Excel' })).not.toHaveProperty('disabled', true);
  });

  it('opens the dashboard in a full-screen view and exits with Escape', async () => {
    render(<QueryAnalysisPage />);

    const dashboardRegion = await screen.findByRole('region', { name: '统计看板内容' });
    fireEvent.click(screen.getByRole('button', { name: '全屏看板' }));

    expect(dashboardRegion.className).toContain('query-section--fullscreen');
    expect(dashboardRegion.className).toContain('query-section--fullscreen-fit');
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(dashboardRegion.className).not.toContain('query-section--fullscreen');
    expect(screen.getByRole('button', { name: '全屏看板' })).toBeTruthy();
  });

  it('queries order completion plans from the order completion tab', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '订单完成' }));
    await screen.findByText('PO-COMPLETE-001');
    fireEvent.change(screen.getByLabelText('计划日期'), { target: { value: '2026-06-05' } });
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'ACTIVE' } });
    fireEvent.change(screen.getByLabelText('生产订单'), { target: { value: 'PO-COMPLETE' } });
    fireEvent.click(screen.getByRole('button', { name: /查询订单完成/ }));

    await waitFor(() => {
      expect(fetchDailyProductionPlansMock).toHaveBeenLastCalledWith({
        date: '2026-06-05',
        status: 'ACTIVE',
        productionOrderNo: 'PO-COMPLETE'
      });
    });

    const table = await screen.findByRole('table', { name: '订单完成结果' });
    expect(within(table).getByText('PO-COMPLETE-001')).toBeTruthy();
    expect(within(table).getByText('订单完成产品')).toBeTruthy();
    expect(within(table).getByText('20')).toBeTruthy();
    expect(within(table).getByText('80%')).toBeTruthy();
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
        defectReasonId: 'reason-1',
        page: 1,
        pageSize: 50
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
    expect(within(table).getAllByText('一号线').length).toBeGreaterThan(0);
    expect(within(table).getByText('车型-A')).toBeTruthy();
    expect(within(table).getByText('PN-ALPHA')).toBeTruthy();
    expect(within(table).getByText('不合格')).toBeTruthy();
    expect(within(table).getByText('划伤')).toBeTruthy();
    expect(within(table).getAllByText('inspector').length).toBeGreaterThan(0);
  });

  it('reclassifies a qualified detail record to unqualified with selected defect reasons', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '明细查询' }));
    fireEvent.click(screen.getByRole('button', { name: /查询/ }));

    const table = await screen.findByRole('table', { name: '明细查询结果' });
    const qualifiedRow = within(table).getByText('DETAIL-QUALIFIED').closest('tr');
    expect(qualifiedRow).toBeTruthy();
    fireEvent.click(within(qualifiedRow as HTMLTableRowElement).getByRole('button', { name: '变更为不合格' }));

    const dialog = await screen.findByRole('dialog', { name: '变更为不合格：DETAIL-QUALIFIED' });
    fireEvent.click(within(dialog).getByLabelText('SCRATCH 划伤'));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认变更' }));

    await waitFor(() => {
      expect(reclassifyInspectionRecordMock).toHaveBeenCalledWith('record-qualified', ['reason-1']);
      expect(fetchDetailRecordsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('updates defect reasons for an unqualified detail record', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '明细查询' }));
    fireEvent.click(screen.getByRole('button', { name: /查询/ }));

    const table = await screen.findByRole('table', { name: '明细查询结果' });
    const unqualifiedRow = within(table).getByText('DETAIL-NEWEST').closest('tr');
    expect(unqualifiedRow).toBeTruthy();
    fireEvent.click(within(unqualifiedRow as HTMLTableRowElement).getByRole('button', { name: '修改原因' }));

    const dialog = await screen.findByRole('dialog', { name: '修改不合格原因：DETAIL-NEWEST' });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存原因' }));

    await waitFor(() => {
      expect(updateUnqualifiedRecordReasonsMock).toHaveBeenCalledWith('record-1', ['reason-1']);
      expect(fetchDetailRecordsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('queries inspection record change logs from the operation record tab', async () => {
    render(<QueryAnalysisPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '操作记录' }));
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-05-31' } });
    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'DETAIL' } });
    fireEvent.change(screen.getByLabelText('操作人'), { target: { value: 'query' } });
    fireEvent.click(screen.getByRole('button', { name: /查询操作记录/ }));

    await waitFor(() => {
      expect(fetchInspectionRecordChangeLogsMock).toHaveBeenCalledWith({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        barcode: 'DETAIL',
        operatorUsername: 'query',
        page: 1,
        pageSize: 50
      });
    });

    const table = await screen.findByRole('table', { name: '操作记录查询结果' });
    expect(within(table).getByText('DETAIL-QUALIFIED')).toBeTruthy();
    expect(within(table).getByText('PN-Q')).toBeTruthy();
    expect(within(table).getByText('合格 -> 不合格')).toBeTruthy();
    expect(within(table).getByText('划伤')).toBeTruthy();
    expect(within(table).getByText('query')).toBeTruthy();
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
