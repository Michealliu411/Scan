import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { ProductionPlanPage } from './ProductionPlanPage';
import {
  closeDailyProductionPlan,
  createDailyProductionPlan,
  fetchDailyProductionPlans,
  fetchProductionPlanLines,
  lookupProductionOrder,
  reopenDailyProductionPlan,
  updateDailyProductionPlan
} from './production-plan-api';
import { DailyProductionPlan } from './production-plan-types';

vi.mock('./production-plan-api', () => ({
  fetchDailyProductionPlans: vi.fn(),
  fetchProductionPlanLines: vi.fn(),
  lookupProductionOrder: vi.fn(),
  createDailyProductionPlan: vi.fn(),
  updateDailyProductionPlan: vi.fn(),
  closeDailyProductionPlan: vi.fn(),
  reopenDailyProductionPlan: vi.fn(),
  copyDailyProductionPlans: vi.fn()
}));

const fetchDailyProductionPlansMock = vi.mocked(fetchDailyProductionPlans);
const fetchProductionPlanLinesMock = vi.mocked(fetchProductionPlanLines);
const lookupProductionOrderMock = vi.mocked(lookupProductionOrder);
const createDailyProductionPlanMock = vi.mocked(createDailyProductionPlan);
const updateDailyProductionPlanMock = vi.mocked(updateDailyProductionPlan);
const closeDailyProductionPlanMock = vi.mocked(closeDailyProductionPlan);
const reopenDailyProductionPlanMock = vi.mocked(reopenDailyProductionPlan);

describe('ProductionPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDailyProductionPlansMock.mockResolvedValue([createPlan()]);
    fetchProductionPlanLinesMock.mockResolvedValue([
      { id: 'line-1', code: 'LINE-01', name: '一号线' },
      { id: 'line-2', code: 'LINE-02', name: '二号线' }
    ]);
    lookupProductionOrderMock.mockResolvedValue({
      barcode: 'SHUIXI-001',
      productionOrderNo: 'PO-001',
      partNumber: 'PN-001',
      productName: '计划产品',
      orderQuantity: 120
    });
    createDailyProductionPlanMock.mockResolvedValue(createPlan({ productionOrderNo: 'PO-001' }));
    updateDailyProductionPlanMock.mockResolvedValue(createPlan({ plannedQuantity: 40 }));
    closeDailyProductionPlanMock.mockResolvedValue(createPlan({ status: 'CLOSED' }));
    reopenDailyProductionPlanMock.mockResolvedValue(createPlan());
  });

  it('reopens a closed plan from the table', async () => {
    fetchDailyProductionPlansMock.mockResolvedValueOnce([
      createPlan({ status: 'CLOSED', closedAt: '2026-06-05T02:00:00.000Z' })
    ]);

    render(<ProductionPlanPage />);

    await screen.findByText('PO-PLAN-001');
    fireEvent.click(screen.getByRole('button', { name: '重新打开' }));

    await waitFor(() => {
      expect(reopenDailyProductionPlanMock).toHaveBeenCalledWith('plan-1');
    });
  });

  it('loads daily plans and renders completion metrics', async () => {
    render(<ProductionPlanPage />);

    expect(await screen.findByRole('heading', { name: '生产计划' })).toBeTruthy();
    expect(await screen.findByText('PO-PLAN-001')).toBeTruthy();
    const metrics = screen.getByLabelText('计划概览');
    expect(within(metrics).getByText('计划订单')).toBeTruthy();
    expect(within(metrics).getByText('今日计划数')).toBeTruthy();
    expect(within(metrics).getByText('合格完成')).toBeTruthy();
    expect(within(metrics).getByText('剩余计划')).toBeTruthy();
    expect(screen.getByRole('table', { name: '生产计划列表' })).toBeTruthy();
  });

  it('looks up a production order and creates a daily plan', async () => {
    render(<ProductionPlanPage />);

    await waitFor(() => {
      expect(fetchProductionPlanLinesMock).toHaveBeenCalled();
    });
    fireEvent.change(screen.getByLabelText('水洗条码'), { target: { value: 'SHUIXI-001' } });
    fireEvent.change(screen.getByLabelText('计划产线'), { target: { value: 'line-2' } });
    fireEvent.click(screen.getByRole('button', { name: '查询订单' }));

    const productionOrderPanel = await screen.findByLabelText('生产订单信息');
    expect(within(productionOrderPanel).getByText('PO-001')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('今日计划数'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: '下达订单' }));

    await waitFor(() => {
      expect(createDailyProductionPlanMock).toHaveBeenCalledWith({
        businessDate: expect.any(String),
        productionOrderNo: 'PO-001',
        partNumber: 'PN-001',
        productName: '计划产品',
        orderQuantity: 120,
        plannedQuantity: 80,
        productionLineId: 'line-2'
      });
    });
    expect(await screen.findByText('生产计划已下达')).toBeTruthy();
  });

  it('shows an actionable message when the production order lookup request cannot reach the API', async () => {
    lookupProductionOrderMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<ProductionPlanPage />);

    fireEvent.change(screen.getByLabelText('水洗条码'), { target: { value: 'SHUIXI-001' } });
    fireEvent.click(screen.getByRole('button', { name: '查询订单' }));

    expect(await screen.findByText('无法连接系统接口，请确认当前页面使用 192.168.1.144:8080 打开，并检查 API 服务是否正常。')).toBeTruthy();
  });

  it('shows a clear no-order message when the external lookup returns no production order data', async () => {
    lookupProductionOrderMock.mockRejectedValueOnce(
      new ApiError(404, {
        code: 'SCAN_LOOKUP_NOT_FOUND',
        message: '查询失败：未查询到相关生产订单信息！'
      })
    );
    render(<ProductionPlanPage />);

    fireEvent.change(screen.getByLabelText('水洗条码'), { target: { value: '3GB881405KNUB 02ST665FKDC19' } });
    fireEvent.click(screen.getByRole('button', { name: '查询订单' }));

    expect(await screen.findByText('未查询到该标签对应的生产订单，请确认标签是否正确，或上游系统是否已生成该生产订单。')).toBeTruthy();
  });

  it('updates and closes an active plan from the table', async () => {
    render(<ProductionPlanPage />);

    await screen.findByText('PO-PLAN-001');
    fireEvent.change(screen.getByLabelText('PO-PLAN-001 今日计划数'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('PO-PLAN-001 计划产线'), { target: { value: 'line-2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateDailyProductionPlanMock).toHaveBeenCalledWith('plan-1', {
        plannedQuantity: 40,
        productionLineId: 'line-2'
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    await waitFor(() => {
      expect(closeDailyProductionPlanMock).toHaveBeenCalledWith('plan-1');
    });
  });

  it('hides the cross-day copy controls from the production plan page', async () => {
    render(<ProductionPlanPage />);

    await screen.findByText('PO-PLAN-001');
    expect(screen.queryByRole('heading', { name: '跨日复制' })).toBeNull();
    expect(screen.queryByRole('button', { name: '复制计划' })).toBeNull();
    expect(screen.queryByLabelText('来源日期')).toBeNull();
    expect(screen.queryByLabelText('目标日期')).toBeNull();
  });
});

function createPlan(overrides: Partial<DailyProductionPlan> = {}): DailyProductionPlan {
  return {
    id: 'plan-1',
    businessDate: '2026-06-05',
    productionOrderNo: 'PO-PLAN-001',
    partNumber: 'PN-PLAN',
    productName: '计划产品',
    orderQuantity: 100,
    plannedQuantity: 30,
    status: 'ACTIVE',
    closedAt: null,
    createdAt: '2026-06-05T01:00:00.000Z',
    updatedAt: '2026-06-05T01:00:00.000Z',
    createdByUsername: 'query',
    updatedByUsername: 'query',
    productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
    qualifiedCount: 12,
    unqualifiedCount: 2,
    remainingQuantity: 18,
    completionRate: 0.4,
    productionLines: [{ id: 'line-1', code: 'LINE-01', name: '一号线' }],
    ...overrides
  };
}
