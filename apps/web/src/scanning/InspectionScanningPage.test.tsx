import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionScanningPage } from './InspectionScanningPage';
import {
  fetchDefectReasons,
  fetchTodayRecords,
  lookupBarcode,
  submitInspectionRecord
} from './scanning-api';

vi.mock('./scanning-api', () => ({
  fetchDefectReasons: vi.fn(),
  fetchTodayRecords: vi.fn(),
  lookupBarcode: vi.fn(),
  submitInspectionRecord: vi.fn()
}));

const lookupBarcodeMock = vi.mocked(lookupBarcode);
const fetchDefectReasonsMock = vi.mocked(fetchDefectReasons);
const fetchTodayRecordsMock = vi.mocked(fetchTodayRecords);
const submitInspectionRecordMock = vi.mocked(submitInspectionRecord);

const defectReasons = [
  { id: 'reason-1', code: 'SCRATCH', name: '划伤' },
  { id: 'reason-2', code: 'DIRTY', name: '污损' }
];

describe('InspectionScanningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDefectReasonsMock.mockResolvedValue(defectReasons);
    fetchTodayRecordsMock.mockResolvedValue([]);
    lookupBarcodeMock.mockResolvedValue({
      kind: 'RESOLVED_PART',
      barcode: 'ABC123456',
      partNumber: 'PN-123456',
      productName: '原始产品名称-ABC1',
      vehicleModel: '车型-ABC1',
      partName: '部件-ABC1',
      productionOrderNo: 'PO-SCAN',
      orderQuantity: 100,
      dailyPlan: {
        status: 'ACTIVE',
        businessDate: '2026-05-07',
        productionOrderNo: 'PO-SCAN',
        productionLine: { id: 'line-1', code: 'LINE-01', name: '一号线' },
        plannedQuantity: 80,
        qualifiedCount: 12,
        unqualifiedCount: 1,
        remainingQuantity: 68
      },
      source: 'PRODUCTION_ORDER_LOOKUP'
    });
    submitInspectionRecordMock.mockResolvedValue({
      id: 'record-1',
      barcode: 'ABC123456',
      productionOrderNo: 'PO-SCAN',
      dailyProductionPlanId: 'plan-1',
      partNumber: 'PN-123456',
      vehicleModel: '车型-ABC1',
      result: 'QUALIFIED',
      scannedAt: '2026-05-07T01:02:03.000Z',
      defectReasons: []
    });
  });

  it("pressing Enter submits a qualified record automatically and removes the 合格 action", async () => {
    render(<InspectionScanningPage />);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    await waitFor(() => {
      expect(lookupBarcodeMock).toHaveBeenCalledWith('ABC123456');
      expect(submitInspectionRecordMock).toHaveBeenCalledWith({
        barcode: 'ABC123456',
        productionOrderNo: 'PO-SCAN',
        partNumber: 'PN-123456',
        productName: '原始产品名称-ABC1',
        vehicleModel: '车型-ABC1',
        partName: '部件-ABC1',
        result: 'QUALIFIED'
      });
    });
    expect(screen.queryByRole('button', { name: '合格' })).toBeNull();
  });

  it('lookup failure preserves the barcode and renders the retry message', async () => {
    lookupBarcodeMock.mockRejectedValueOnce({
      payload: {
        code: 'SCAN_LOOKUP_NOT_FOUND',
        message: '未找到零件信息，请修改后重试或重新扫描'
      }
    });

    render(<InspectionScanningPage />);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'UNKNOWN-001' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    expect(await screen.findByText('未找到零件信息，请修改后重试或重新扫描')).toBeTruthy();
    expect(screen.getByLabelText('条码')).toHaveProperty('value', 'UNKNOWN-001');
  });

  it('clears barcode, resolved part, and messages when clicking 清空', async () => {
    render(<InspectionScanningPage />);

    await resolveBarcodeForUnqualified();
    fireEvent.click(screen.getByRole('button', { name: '清空' }));

    expect(screen.getByLabelText('条码')).toHaveProperty('value', '');
    expect(screen.queryByText('PN-123456')).toBeNull();
  });

  it('clicking 不合格 before scanning reveals defect reasons with Submit disabled before selection for SCAN-07', async () => {
    render(<InspectionScanningPage />);

    fireEvent.click(screen.getByRole('button', { name: '不合格' }));

    expect(await screen.findByText('选择缺陷原因')).toBeTruthy();
    expect(screen.getByRole('button', { name: '提交' })).toHaveProperty('disabled', true);
    expect(submitInspectionRecordMock).not.toHaveBeenCalled();
  });

  it('uses the matched action panel layout with two wide operation buttons', async () => {
    render(<InspectionScanningPage />);

    await waitFor(() => {
      expect(fetchDefectReasonsMock).toHaveBeenCalled();
      expect(fetchTodayRecordsMock).toHaveBeenCalled();
    });

    const actionsPanel = screen.getByRole('region', { name: '检验操作' });
    const actionButtons = actionsPanel.querySelector('.scan-action-buttons');

    expect(actionsPanel.classList.contains('scan-actions--matched-input')).toBe(true);
    expect(actionButtons?.classList.contains('scan-action-buttons--two-wide')).toBe(true);
  });

  it('disables browser history suggestions on the barcode scan input', async () => {
    render(<InspectionScanningPage />);

    await waitFor(() => {
      expect(fetchDefectReasonsMock).toHaveBeenCalled();
      expect(fetchTodayRecordsMock).toHaveBeenCalled();
    });

    const barcodeInput = screen.getByLabelText('条码');

    expect(barcodeInput.getAttribute('autocomplete')).toBe('off');
    expect(barcodeInput.getAttribute('name')).toBe('scan-barcode');
    expect(barcodeInput.closest('form')?.getAttribute('autocomplete')).toBe('off');
  });

  it('selecting reasons before scanning then clicking Submit creates an unqualified record', async () => {
    render(<InspectionScanningPage />);

    fireEvent.click(screen.getByRole('button', { name: '不合格' }));
    fireEvent.click(await screen.findByLabelText('SCRATCH 划伤'));
    fireEvent.click(screen.getByLabelText('DIRTY 污损'));
    expect(screen.getByRole('button', { name: '提交' })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });
    expect(await screen.findByText('PN-123456')).toBeTruthy();
    expect(screen.getByText('计划产线 一号线')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(submitInspectionRecordMock).toHaveBeenCalledWith({
        barcode: 'ABC123456',
        productionOrderNo: 'PO-SCAN',
        partNumber: 'PN-123456',
        productName: '原始产品名称-ABC1',
        vehicleModel: '车型-ABC1',
        partName: '部件-ABC1',
        result: 'UNQUALIFIED',
        defectReasonIds: ['reason-1', 'reason-2']
      });
    });
  });

  it('successful submit clears the barcode input and appends the created record without refetching today records', async () => {
    render(<InspectionScanningPage />);

    scanBarcode();

    expect(await screen.findByText('检验记录已提交')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('条码')).toHaveProperty('value', '');
      expect(fetchTodayRecordsMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('ABC123456')).toBeTruthy();
  });

  it('queues consecutive qualified scans while the first submit is still running', async () => {
    let resolveFirstSubmit: (record: Awaited<ReturnType<typeof submitInspectionRecord>>) => void = () => {};
    lookupBarcodeMock
      .mockResolvedValueOnce({
        kind: 'RESOLVED_PART',
        barcode: 'FAST-001',
        partNumber: 'PN-001',
        vehicleModel: '车型-001',
        productionOrderNo: 'PO-SCAN',
        source: 'PRODUCTION_ORDER_LOOKUP'
      })
      .mockResolvedValueOnce({
        kind: 'RESOLVED_PART',
        barcode: 'FAST-002',
        partNumber: 'PN-002',
        vehicleModel: '车型-002',
        productionOrderNo: 'PO-SCAN',
        source: 'PRODUCTION_ORDER_LOOKUP'
      });
    submitInspectionRecordMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSubmit = resolve;
          })
      )
      .mockResolvedValueOnce({
        id: 'record-2',
        barcode: 'FAST-002',
        productionOrderNo: 'PO-SCAN',
        dailyProductionPlanId: 'plan-1',
        partNumber: 'PN-002',
        vehicleModel: '车型-002',
        result: 'QUALIFIED',
        scannedAt: '2026-05-07T01:02:04.000Z',
        defectReasons: []
      });

    render(<InspectionScanningPage />);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'FAST-001' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    await waitFor(() => {
      expect(submitInspectionRecordMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText('条码')).toHaveProperty('disabled', false);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'FAST-002' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    expect(await screen.findByText(/待处理 1 条/)).toBeTruthy();

    await act(async () => {
      resolveFirstSubmit({
        id: 'record-1',
        barcode: 'FAST-001',
        productionOrderNo: 'PO-SCAN',
        dailyProductionPlanId: 'plan-1',
        partNumber: 'PN-001',
        vehicleModel: '车型-001',
        result: 'QUALIFIED',
        scannedAt: '2026-05-07T01:02:03.000Z',
        defectReasons: []
      });
    });

    await waitFor(() => {
      expect(lookupBarcodeMock).toHaveBeenCalledWith('FAST-002');
      expect(submitInspectionRecordMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchTodayRecordsMock).toHaveBeenCalledTimes(1);
  });

  it('QUALIFIED_BARCODE_DUPLICATE renders existing production line and inspector details', async () => {
    submitInspectionRecordMock.mockRejectedValueOnce({
      payload: {
        code: 'QUALIFIED_BARCODE_DUPLICATE',
        message: '该条码已存在合格记录，不能重复提交',
        existingRecord: {
          scannedAt: '2026-05-07T01:02:03.000Z',
          productionLine: { name: '扫描测试产线' },
          inspector: { username: 'inspector' }
        }
      }
    });

    render(<InspectionScanningPage />);

    scanBarcode();

    expect(await screen.findByText('该条码已存在合格记录，不能重复提交')).toBeTruthy();
    expect(screen.getByText(/扫描测试产线/)).toBeTruthy();
    expect(screen.getByText(/inspector/)).toBeTruthy();
  });

  it('detail list renders time, barcode, part number, vehicle model, result, and defect reasons', async () => {
    fetchTodayRecordsMock.mockResolvedValueOnce([
      {
        id: 'record-2',
        barcode: 'DEF-000002',
        productionOrderNo: 'PO-DETAIL',
        dailyProductionPlanId: 'plan-detail',
        partNumber: 'PN-000002',
        vehicleModel: '车型-DEF',
        result: 'UNQUALIFIED',
        scannedAt: '2026-05-07T01:02:03.000Z',
        defectReasons: ['划伤', '污损']
      }
    ]);

    render(<InspectionScanningPage />);

    const details = await screen.findByRole('region', { name: '今日检验明细' });
    expect(within(details).getByText(/09:02:03|01:02:03/)).toBeTruthy();
    expect(within(details).getByText('DEF-000002')).toBeTruthy();
    expect(within(details).getByText('PO-DETAIL')).toBeTruthy();
    expect(within(details).getByText('PN-000002')).toBeTruthy();
    expect(within(details).getByText('车型-DEF')).toBeTruthy();
    expect(within(details).getByText('不合格')).toBeTruthy();
    expect(within(details).getByText('划伤、污损')).toBeTruthy();
  });

  it('dirty special barcode lookup auto-submits and appends the created record', async () => {
    lookupBarcodeMock.mockResolvedValueOnce({
      kind: 'DIRTY_BARCODE_AUTO_SUBMITTED',
      record: {
        id: 'record-dirty',
        barcode: '22222222-2222-4222-8222-222222222222',
        partNumber: 'DIRTY-BARCODE',
        vehicleModel: null,
        result: 'UNQUALIFIED',
        scannedAt: '2026-05-07T01:02:03.000Z',
        defectReasons: ['条码污损']
      }
    });

    render(<InspectionScanningPage />);

    fireEvent.change(screen.getByLabelText('条码'), {
      target: { value: '22222222-2222-4222-8222-222222222222' }
    });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    expect(await screen.findByText('条码污损记录已自动提交')).toBeTruthy();
    await waitFor(() => {
      expect(fetchTodayRecordsMock).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('条码')).toHaveProperty('value', '');
    });
    expect(screen.getByText('22222222-2222-4222-8222-222222222222')).toBeTruthy();
    expect(submitInspectionRecordMock).not.toHaveBeenCalled();
  });

  it('persists the selected scan panel layout', async () => {
    const { unmount } = render(<InspectionScanningPage />);

    await waitFor(() => {
      expect(fetchDefectReasonsMock).toHaveBeenCalled();
      expect(fetchTodayRecordsMock).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: '明细优先' }));

    expect(window.localStorage.getItem('scan.workstationLayout')).toBe('details-first');
    expect(screen.getByRole('button', { name: '明细优先' }).getAttribute('aria-pressed')).toBe('true');

    unmount();
    render(<InspectionScanningPage />);

    expect(screen.getByRole('button', { name: '明细优先' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(fetchTodayRecordsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('focuses the barcode input after a successful qualified submission', async () => {
    render(<InspectionScanningPage />);

    scanBarcode();

    expect(await screen.findByText('检验记录已提交')).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('条码'));
    });
  });
});

function scanBarcode() {
  fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
  fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });
}

async function resolveBarcodeForUnqualified() {
  fireEvent.click(screen.getByRole('button', { name: '不合格' }));
  fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
  fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });
  await screen.findByText('PN-123456');
}
