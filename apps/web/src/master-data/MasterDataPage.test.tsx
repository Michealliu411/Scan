import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  fetchManagedDefectReasons,
  fetchManagedProductionLines,
  fetchManagedSpecialBarcodes,
  generateSpecialBarcode,
  fetchManagedUsers,
  createDefectReason,
  updateDefectReason,
  deleteDefectReason,
  createProductionLine,
  updateProductionLine,
  deleteProductionLine,
  createSpecialBarcode,
  updateSpecialBarcode,
  deleteSpecialBarcode,
  resetManagedUserPassword
} from './master-data-api';
import { MasterDataPage } from './MasterDataPage';

vi.mock('./master-data-api', () => ({
  fetchManagedUsers: vi.fn(),
  createManagedUser: vi.fn(),
  updateManagedUser: vi.fn(),
  deleteManagedUser: vi.fn(),
  resetManagedUserPassword: vi.fn(),
  fetchManagedDefectReasons: vi.fn(),
  fetchManagedProductionLines: vi.fn()
  ,
  fetchManagedSpecialBarcodes: vi.fn(),
  generateSpecialBarcode: vi.fn(),
  createDefectReason: vi.fn(),
  updateDefectReason: vi.fn(),
  deleteDefectReason: vi.fn(),
  createProductionLine: vi.fn(),
  updateProductionLine: vi.fn(),
  deleteProductionLine: vi.fn(),
  createSpecialBarcode: vi.fn(),
  updateSpecialBarcode: vi.fn(),
  deleteSpecialBarcode: vi.fn()
}));

const fetchManagedUsersMock = vi.mocked(fetchManagedUsers);
const createManagedUserMock = vi.mocked(createManagedUser);
const updateManagedUserMock = vi.mocked(updateManagedUser);
const deleteManagedUserMock = vi.mocked(deleteManagedUser);
const resetManagedUserPasswordMock = vi.mocked(resetManagedUserPassword);
const fetchManagedDefectReasonsMock = vi.mocked(fetchManagedDefectReasons);
const fetchManagedProductionLinesMock = vi.mocked(fetchManagedProductionLines);
const fetchManagedSpecialBarcodesMock = vi.mocked(fetchManagedSpecialBarcodes);
const generateSpecialBarcodeMock = vi.mocked(generateSpecialBarcode);
const createDefectReasonMock = vi.mocked(createDefectReason);
const updateDefectReasonMock = vi.mocked(updateDefectReason);
const deleteDefectReasonMock = vi.mocked(deleteDefectReason);
const createProductionLineMock = vi.mocked(createProductionLine);
const updateProductionLineMock = vi.mocked(updateProductionLine);
const deleteProductionLineMock = vi.mocked(deleteProductionLine);
const createSpecialBarcodeMock = vi.mocked(createSpecialBarcode);
const updateSpecialBarcodeMock = vi.mocked(updateSpecialBarcode);
const deleteSpecialBarcodeMock = vi.mocked(deleteSpecialBarcode);

describe('MasterDataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchManagedUsersMock.mockResolvedValue([
      {
        id: 'user-1',
        username: 'inspector',
        role: 'INSPECTOR',
        isActive: true,
        mustChangePassword: false,
        referenced: true,
        canEdit: true,
        canDelete: false,
        canResetPassword: true
      },
      {
        id: 'user-admin',
        username: 'admin',
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        referenced: true,
        canEdit: false,
        canDelete: false,
        canResetPassword: false
      }
    ]);
    fetchManagedDefectReasonsMock.mockResolvedValue([
      {
        id: 'reason-1',
        code: 'SCRATCH',
        name: '划伤',
        isActive: true,
        referenced: true,
        canEdit: false,
        canDelete: false
      }
    ]);
    fetchManagedProductionLinesMock.mockResolvedValue([
      {
        id: 'line-1',
        code: 'LINE-01',
        name: '一号线',
        sortOrder: 1,
        isActive: true,
        referenced: false,
        canDelete: true
      }
    ]);
    fetchManagedSpecialBarcodesMock.mockResolvedValue([
      {
        id: 'special-1',
        type: 'DIRTY',
        barcode: '22222222-2222-4222-8222-222222222222',
        vehicleModel: null,
        partNumber: null,
        defectReason: { id: 'reason-dirty', code: 'BARCODE_DAMAGED', name: '条码污损' },
        isActive: true,
        referenced: true,
        canEdit: false,
        canDelete: false
      }
    ]);
    generateSpecialBarcodeMock.mockResolvedValue({ barcode: '44444444-4444-4444-8444-444444444444' });
    createManagedUserMock.mockResolvedValue({
      id: 'user-2',
      username: 'new-inspector',
      role: 'INSPECTOR',
      isActive: true,
      mustChangePassword: true,
      referenced: false,
      canEdit: true,
      canDelete: true,
      canResetPassword: true
    });
    updateManagedUserMock.mockResolvedValue({
      id: 'user-1',
      username: 'inspector',
      role: 'QUERY',
      isActive: true,
      mustChangePassword: false,
      referenced: true,
      canEdit: true,
      canDelete: false,
      canResetPassword: true
    });
    deleteManagedUserMock.mockResolvedValue({ ok: true });
    resetManagedUserPasswordMock.mockResolvedValue({ ok: true });
    createDefectReasonMock.mockResolvedValue({
      id: 'reason-2',
      code: 'BURR',
      name: '毛刺',
      isActive: true,
      referenced: false,
      canEdit: true,
      canDelete: true
    });
    updateDefectReasonMock.mockResolvedValue({
      id: 'reason-1',
      code: 'SCRATCH',
      name: '轻微划伤',
      isActive: true,
      referenced: false,
      canEdit: true,
      canDelete: true
    });
    deleteDefectReasonMock.mockResolvedValue({ ok: true });
    createProductionLineMock.mockResolvedValue({
      id: 'line-2',
      code: 'LINE-02',
      name: '二号线',
      sortOrder: 2,
      isActive: true,
      referenced: false,
      canDelete: true
    });
    deleteProductionLineMock.mockResolvedValue({ ok: true });
    updateProductionLineMock.mockResolvedValue({
      id: 'line-1',
      code: 'LINE-01',
      name: '一号线新名称',
      sortOrder: 1,
      isActive: true,
      referenced: true,
      canDelete: false
    });
    createSpecialBarcodeMock.mockResolvedValue({
      id: 'special-2',
      type: 'NO_BARCODE_PRODUCT',
      barcode: '44444444-4444-4444-8444-444444444444',
      vehicleModel: '车型-X',
      partNumber: 'PN-X',
      defectReason: null,
      isActive: true,
      referenced: false,
      canEdit: true,
      canDelete: true
    });
    updateSpecialBarcodeMock.mockResolvedValue({
      id: 'special-1',
      type: 'DIRTY',
      barcode: '22222222-2222-4222-8222-222222222222',
      vehicleModel: null,
      partNumber: null,
      defectReason: { id: 'reason-dirty', code: 'BARCODE_DAMAGED', name: '条码污损' },
      isActive: false,
      referenced: true,
      canEdit: false,
      canDelete: false
    });
    deleteSpecialBarcodeMock.mockResolvedValue({ ok: true });
  });

  it('renders the three master data areas and loaded rows', async () => {
    render(<MasterDataPage />);

    expect(await screen.findByRole('heading', { name: '基础数据管理' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '用户' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '缺陷原因' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '产线' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '特殊条码' })).toBeTruthy();
    expect(await screen.findByText('inspector')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '缺陷原因' }));
    expect(await screen.findByText('SCRATCH')).toBeTruthy();
    expect(screen.getByText('划伤')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '产线' }));
    expect(await screen.findByText('LINE-01')).toBeTruthy();
    expect(screen.getByText('一号线')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '特殊条码' }));
    expect(await screen.findByText('22222222-2222-4222-8222-222222222222')).toBeTruthy();
    expect(screen.getAllByText('条码污损').length).toBeGreaterThan(0);
  });

  it('shows reference protection and disables unsafe defect reason deletion', async () => {
    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '缺陷原因' }));

    const row = await screen.findByRole('row', { name: /SCRATCH/ });
    expect(within(row).getByText('已引用')).toBeTruthy();
    expect(within(row).getByRole('button', { name: '删除缺陷原因 SCRATCH' })).toHaveProperty('disabled', true);
    expect(within(row).getByText('已引用，只能停用')).toBeTruthy();
  });

  it('creates a user and refreshes user data', async () => {
    fetchManagedUsersMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'user-2',
          username: 'new-inspector',
          role: 'INSPECTOR',
          isActive: true,
          mustChangePassword: true,
          referenced: false,
          canEdit: true,
          canDelete: true,
          canResetPassword: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('button', { name: '新增用户' }));
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'new-inspector' } });
    fireEvent.change(screen.getByLabelText('初始密码'), { target: { value: 'temporary-password' } });
    fireEvent.click(screen.getByRole('button', { name: '保存用户' }));

    await waitFor(() => {
      expect(createManagedUserMock).toHaveBeenCalledWith({
        username: 'new-inspector',
        password: 'temporary-password',
        role: 'INSPECTOR',
        isActive: true
      });
      expect(fetchManagedUsersMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('new-inspector')).toBeTruthy();
  });

  it('resets an inspector password and shows the result', async () => {
    render(<MasterDataPage />);

    const row = await screen.findByRole('row', { name: /inspector/ });
    fireEvent.click(within(row).getByRole('button', { name: '重置密码 inspector' }));
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'reset-password' } });
    fireEvent.click(screen.getByRole('button', { name: '确认重置' }));

    await waitFor(() => {
      expect(resetManagedUserPasswordMock).toHaveBeenCalledWith('user-1', 'reset-password');
    });
    expect(await screen.findByText('密码已重置，用户下次登录需要修改密码')).toBeTruthy();
  });

  it('deletes an unreferenced user and refreshes user data', async () => {
    fetchManagedUsersMock
      .mockResolvedValueOnce([
        {
          id: 'user-delete',
          username: 'delete-me',
          role: 'INSPECTOR',
          isActive: true,
          mustChangePassword: false,
          referenced: false,
          canEdit: true,
          canDelete: true,
          canResetPassword: true
        }
      ])
      .mockResolvedValueOnce([]);

    render(<MasterDataPage />);

    const row = await screen.findByRole('row', { name: /delete-me/ });
    fireEvent.click(within(row).getByRole('button', { name: '删除用户 delete-me' }));

    await waitFor(() => {
      expect(deleteManagedUserMock).toHaveBeenCalledWith('user-delete');
      expect(fetchManagedUsersMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('用户已删除')).toBeTruthy();
  });

  it('disables admin account editing in the user table', async () => {
    render(<MasterDataPage />);

    const row = await screen.findByRole('row', { name: /admin/ });

    expect(within(row).getByRole('button', { name: '编辑用户 admin' })).toHaveProperty('disabled', true);
  });

  it('edits a user role and refreshes user data', async () => {
    fetchManagedUsersMock
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          username: 'inspector',
          role: 'INSPECTOR',
          isActive: true,
          mustChangePassword: false,
          referenced: true,
          canEdit: true,
          canDelete: false,
          canResetPassword: true
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          username: 'inspector',
          role: 'QUERY',
          isActive: true,
          mustChangePassword: false,
          referenced: true,
          canEdit: true,
          canDelete: false,
          canResetPassword: true
        }
      ]);

    render(<MasterDataPage />);

    const row = await screen.findByRole('row', { name: /inspector/ });
    fireEvent.click(within(row).getByRole('button', { name: '编辑用户 inspector' }));
    expect(screen.getByRole('dialog', { name: '编辑用户：inspector' }).parentElement?.classList.contains('modal-backdrop')).toBe(true);
    fireEvent.change(screen.getByLabelText('角色'), { target: { value: 'QUERY' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateManagedUserMock).toHaveBeenCalledWith('user-1', { role: 'QUERY' });
      expect(fetchManagedUsersMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('查询用户')).toBeTruthy();
  });

  it('creates a defect reason and refreshes defect data', async () => {
    fetchManagedDefectReasonsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'reason-2',
          code: 'BURR',
          name: '毛刺',
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '缺陷原因' }));
    fireEvent.click(screen.getByRole('button', { name: '新增缺陷原因' }));
    fireEvent.change(screen.getByLabelText('缺陷编码'), { target: { value: 'BURR' } });
    fireEvent.change(screen.getByLabelText('缺陷名称'), { target: { value: '毛刺' } });
    fireEvent.click(screen.getByRole('button', { name: '保存缺陷原因' }));

    await waitFor(() => {
      expect(createDefectReasonMock).toHaveBeenCalledWith({
        code: 'BURR',
        name: '毛刺',
        isActive: true
      });
      expect(fetchManagedDefectReasonsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('BURR')).toBeTruthy();
  });

  it('edits an unreferenced defect reason name', async () => {
    fetchManagedDefectReasonsMock
      .mockResolvedValueOnce([
        {
          id: 'reason-1',
          code: 'SCRATCH',
          name: '划伤',
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'reason-1',
          code: 'SCRATCH',
          name: '轻微划伤',
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '缺陷原因' }));
    const row = await screen.findByRole('row', { name: /SCRATCH/ });
    fireEvent.click(within(row).getByRole('button', { name: '编辑缺陷原因 SCRATCH' }));
    fireEvent.change(screen.getByLabelText('缺陷名称'), { target: { value: '轻微划伤' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateDefectReasonMock).toHaveBeenCalledWith('reason-1', { name: '轻微划伤' });
      expect(fetchManagedDefectReasonsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('轻微划伤')).toBeTruthy();
  });

  it('toggles defect reason active state and refreshes defect data', async () => {
    fetchManagedDefectReasonsMock
      .mockResolvedValueOnce([
        {
          id: 'reason-1',
          code: 'SCRATCH',
          name: '划伤',
          isActive: true,
          referenced: true,
          canEdit: false,
          canDelete: false
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'reason-1',
          code: 'SCRATCH',
          name: '划伤',
          isActive: false,
          referenced: true,
          canEdit: false,
          canDelete: false
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '缺陷原因' }));
    const row = await screen.findByRole('row', { name: /SCRATCH/ });
    fireEvent.click(within(row).getByRole('button', { name: '停用缺陷原因 SCRATCH' }));

    await waitFor(() => {
      expect(updateDefectReasonMock).toHaveBeenCalledWith('reason-1', { isActive: false });
      expect(fetchManagedDefectReasonsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('停用')).toBeTruthy();
  });

  it('deletes an unreferenced defect reason and refreshes defect data', async () => {
    fetchManagedDefectReasonsMock
      .mockResolvedValueOnce([
        {
          id: 'reason-delete',
          code: 'BURR',
          name: '毛刺',
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '缺陷原因' }));
    const row = await screen.findByRole('row', { name: /BURR/ });
    fireEvent.click(within(row).getByRole('button', { name: '删除缺陷原因 BURR' }));

    await waitFor(() => {
      expect(deleteDefectReasonMock).toHaveBeenCalledWith('reason-delete');
      expect(fetchManagedDefectReasonsMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('缺陷原因已删除')).toBeTruthy();
  });

  it('creates a production line and refreshes line data', async () => {
    fetchManagedProductionLinesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'line-2',
          code: 'LINE-02',
          name: '二号线',
          sortOrder: 2,
          isActive: true,
          referenced: false,
          canDelete: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '产线' }));
    fireEvent.click(screen.getByRole('button', { name: '新增产线' }));
    fireEvent.change(screen.getByLabelText('产线编码'), { target: { value: 'LINE-02' } });
    fireEvent.change(screen.getByLabelText('产线名称'), { target: { value: '二号线' } });
    fireEvent.change(screen.getByLabelText('排序'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存产线' }));

    await waitFor(() => {
      expect(createProductionLineMock).toHaveBeenCalledWith({
        code: 'LINE-02',
        name: '二号线',
        sortOrder: 2,
        isActive: true
      });
      expect(fetchManagedProductionLinesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('LINE-02')).toBeTruthy();
  });

  it('edits a referenced production line name', async () => {
    fetchManagedProductionLinesMock
      .mockResolvedValueOnce([
        {
          id: 'line-1',
          code: 'LINE-01',
          name: '一号线',
          sortOrder: 1,
          isActive: true,
          referenced: true,
          canDelete: false
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'line-1',
          code: 'LINE-01',
          name: '一号线新名称',
          sortOrder: 1,
          isActive: true,
          referenced: true,
          canDelete: false
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '产线' }));
    const row = await screen.findByRole('row', { name: /LINE-01/ });
    fireEvent.click(within(row).getByRole('button', { name: '编辑产线 LINE-01' }));
    fireEvent.change(screen.getByLabelText('产线名称'), { target: { value: '一号线新名称' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateProductionLineMock).toHaveBeenCalledWith('line-1', { name: '一号线新名称' });
      expect(fetchManagedProductionLinesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('一号线新名称')).toBeTruthy();
  });

  it('toggles production line active state and refreshes line data', async () => {
    fetchManagedProductionLinesMock
      .mockResolvedValueOnce([
        {
          id: 'line-1',
          code: 'LINE-01',
          name: '一号线',
          sortOrder: 1,
          isActive: true,
          referenced: true,
          canDelete: false
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'line-1',
          code: 'LINE-01',
          name: '一号线',
          sortOrder: 1,
          isActive: false,
          referenced: true,
          canDelete: false
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '产线' }));
    const row = await screen.findByRole('row', { name: /LINE-01/ });
    fireEvent.click(within(row).getByRole('button', { name: '停用产线 LINE-01' }));

    await waitFor(() => {
      expect(updateProductionLineMock).toHaveBeenCalledWith('line-1', { isActive: false });
      expect(fetchManagedProductionLinesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('停用')).toBeTruthy();
  });

  it('deletes an unreferenced production line and refreshes line data', async () => {
    fetchManagedProductionLinesMock
      .mockResolvedValueOnce([
        {
          id: 'line-delete',
          code: 'LINE-DELETE',
          name: '待删除产线',
          sortOrder: 9,
          isActive: true,
          referenced: false,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '产线' }));
    const row = await screen.findByRole('row', { name: /LINE-DELETE/ });
    fireEvent.click(within(row).getByRole('button', { name: '删除产线 LINE-DELETE' }));

    await waitFor(() => {
      expect(deleteProductionLineMock).toHaveBeenCalledWith('line-delete');
      expect(fetchManagedProductionLinesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('产线已删除')).toBeTruthy();
  });

  it('creates a no-barcode product special barcode with generated UUID preview', async () => {
    fetchManagedSpecialBarcodesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'special-2',
          type: 'NO_BARCODE_PRODUCT',
          barcode: '44444444-4444-4444-8444-444444444444',
          vehicleModel: '车型-X',
          partNumber: 'PN-X',
          defectReason: null,
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '特殊条码' }));
    fireEvent.click(screen.getByRole('button', { name: '新增无条码产品' }));

    expect(await screen.findByDisplayValue('44444444-4444-4444-8444-444444444444')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('车型'), { target: { value: '车型-X' } });
    fireEvent.change(screen.getByLabelText('零件号'), { target: { value: 'PN-X' } });
    fireEvent.click(screen.getByRole('button', { name: '保存无条码产品' }));

    await waitFor(() => {
      expect(createSpecialBarcodeMock).toHaveBeenCalledWith({
        type: 'NO_BARCODE_PRODUCT',
        barcode: '44444444-4444-4444-8444-444444444444',
        vehicleModel: '车型-X',
        partNumber: 'PN-X',
        isActive: true
      });
      expect(fetchManagedSpecialBarcodesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('PN-X')).toBeTruthy();
  });

  it('disables and deletes special barcode rows through operation buttons', async () => {
    fetchManagedSpecialBarcodesMock
      .mockResolvedValueOnce([
        {
          id: 'special-2',
          type: 'NO_BARCODE_PRODUCT',
          barcode: '44444444-4444-4444-8444-444444444444',
          vehicleModel: '车型-X',
          partNumber: 'PN-X',
          defectReason: null,
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'special-2',
          type: 'NO_BARCODE_PRODUCT',
          barcode: '44444444-4444-4444-8444-444444444444',
          vehicleModel: '车型-X',
          partNumber: 'PN-X',
          defectReason: null,
          isActive: false,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '特殊条码' }));
    const row = await screen.findByRole('row', { name: /44444444/ });
    fireEvent.click(within(row).getByRole('button', { name: '停用特殊条码 44444444-4444-4444-8444-444444444444' }));

    await waitFor(() => {
      expect(updateSpecialBarcodeMock).toHaveBeenCalledWith('special-2', { isActive: false });
    });

    const refreshedRow = await screen.findByRole('row', { name: /44444444/ });
    fireEvent.click(within(refreshedRow).getByRole('button', { name: '删除特殊条码 44444444-4444-4444-8444-444444444444' }));

    await waitFor(() => {
      expect(deleteSpecialBarcodeMock).toHaveBeenCalledWith('special-2');
      expect(fetchManagedSpecialBarcodesMock).toHaveBeenCalledTimes(3);
    });
  });

  it('edits an unreferenced no-barcode product vehicle model and part number', async () => {
    fetchManagedSpecialBarcodesMock
      .mockResolvedValueOnce([
        {
          id: 'special-2',
          type: 'NO_BARCODE_PRODUCT',
          barcode: '44444444-4444-4444-8444-444444444444',
          vehicleModel: '车型-X',
          partNumber: 'PN-X',
          defectReason: null,
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'special-2',
          type: 'NO_BARCODE_PRODUCT',
          barcode: '44444444-4444-4444-8444-444444444444',
          vehicleModel: '车型-Y',
          partNumber: 'PN-Y',
          defectReason: null,
          isActive: true,
          referenced: false,
          canEdit: true,
          canDelete: true
        }
      ]);

    render(<MasterDataPage />);

    fireEvent.click(await screen.findByRole('tab', { name: '特殊条码' }));
    const row = await screen.findByRole('row', { name: /44444444/ });
    fireEvent.click(within(row).getByRole('button', { name: '编辑特殊条码 44444444-4444-4444-8444-444444444444' }));
    fireEvent.change(screen.getByLabelText('车型'), { target: { value: '车型-Y' } });
    fireEvent.change(screen.getByLabelText('零件号'), { target: { value: 'PN-Y' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateSpecialBarcodeMock).toHaveBeenCalledWith('special-2', {
        vehicleModel: '车型-Y',
        partNumber: 'PN-Y'
      });
      expect(fetchManagedSpecialBarcodesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('PN-Y')).toBeTruthy();
  });
});
