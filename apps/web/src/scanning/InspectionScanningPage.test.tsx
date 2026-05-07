import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      barcode: 'ABC123456',
      partNumber: 'PN-123456',
      vehicleModel: '车型-ABC1'
    });
    submitInspectionRecordMock.mockResolvedValue({
      id: 'record-1',
      barcode: 'ABC123456',
      partNumber: 'PN-123456',
      vehicleModel: '车型-ABC1',
      result: 'QUALIFIED',
      scannedAt: '2026-05-07T01:02:03.000Z',
      defectReasons: []
    });
  });

  it('pressing Enter calls lookup and renders part number before vehicle model', async () => {
    render(<InspectionScanningPage />);

    fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
    fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });

    expect(await screen.findByText('PN-123456')).toBeTruthy();
    expect(lookupBarcodeMock).toHaveBeenCalledWith('ABC123456');

    const partNumber = screen.getByText('PN-123456');
    const vehicleModel = screen.getByText('车型-ABC1');
    expect(partNumber.compareDocumentPosition(vehicleModel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("clicking 合格 immediately submits with result: 'QUALIFIED'", async () => {
    render(<InspectionScanningPage />);

    await resolveBarcode();
    fireEvent.click(screen.getByRole('button', { name: '合格' }));

    await waitFor(() => {
      expect(submitInspectionRecordMock).toHaveBeenCalledWith({
        barcode: 'ABC123456',
        partNumber: 'PN-123456',
        vehicleModel: '车型-ABC1',
        result: 'QUALIFIED'
      });
    });
  });

  it('clicking 不合格 reveals defect reasons with Submit disabled before selection for SCAN-07', async () => {
    render(<InspectionScanningPage />);

    await resolveBarcode();
    fireEvent.click(screen.getByRole('button', { name: '不合格' }));

    expect(await screen.findByText('选择缺陷原因')).toBeTruthy();
    expect(screen.getByRole('button', { name: '提交' })).toHaveProperty('disabled', true);
  });

  it('selecting multiple reasons enables Submit and submits both IDs', async () => {
    render(<InspectionScanningPage />);

    await resolveBarcode();
    fireEvent.click(screen.getByRole('button', { name: '不合格' }));
    fireEvent.click(await screen.findByLabelText('SCRATCH 划伤'));
    fireEvent.click(screen.getByLabelText('DIRTY 污损'));
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => {
      expect(submitInspectionRecordMock).toHaveBeenCalledWith({
        barcode: 'ABC123456',
        partNumber: 'PN-123456',
        vehicleModel: '车型-ABC1',
        result: 'UNQUALIFIED',
        defectReasonIds: ['reason-1', 'reason-2']
      });
    });
  });

  it('successful submit clears the barcode input and calls fetchTodayRecords', async () => {
    render(<InspectionScanningPage />);

    await resolveBarcode();
    fireEvent.click(screen.getByRole('button', { name: '合格' }));

    expect(await screen.findByText('检验记录已提交')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('条码')).toHaveProperty('value', '');
      expect(fetchTodayRecordsMock).toHaveBeenCalledTimes(2);
    });
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

    await resolveBarcode();
    fireEvent.click(screen.getByRole('button', { name: '合格' }));

    expect(await screen.findByText('该条码已存在合格记录，不能重复提交')).toBeTruthy();
    expect(screen.getByText(/扫描测试产线/)).toBeTruthy();
    expect(screen.getByText(/inspector/)).toBeTruthy();
  });

  it('detail list renders time, barcode, part number, vehicle model, result, and defect reasons', async () => {
    fetchTodayRecordsMock.mockResolvedValueOnce([
      {
        id: 'record-2',
        barcode: 'DEF-000002',
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
    expect(within(details).getByText('PN-000002')).toBeTruthy();
    expect(within(details).getByText('车型-DEF')).toBeTruthy();
    expect(within(details).getByText('不合格')).toBeTruthy();
    expect(within(details).getByText('划伤、污损')).toBeTruthy();
  });
});

async function resolveBarcode() {
  fireEvent.change(screen.getByLabelText('条码'), { target: { value: 'ABC123456' } });
  fireEvent.keyDown(screen.getByLabelText('条码'), { key: 'Enter' });
  await screen.findByText('PN-123456');
}
