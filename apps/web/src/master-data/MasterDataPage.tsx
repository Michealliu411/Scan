import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, extractApiMessage } from '../api/client';
import { Role } from '../auth/auth-types';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import {
  createManagedUser,
  createDefectReason,
  createProductionLine,
  fetchManagedDefectReasons,
  fetchManagedProductionLines,
  fetchManagedSpecialBarcodes,
  fetchManagedUsers,
  generateSpecialBarcode,
  createSpecialBarcode,
  updateSpecialBarcode,
  deleteSpecialBarcode,
  resetManagedUserPassword
} from './master-data-api';
import {
  ManagedDefectReason,
  ManagedProductionLine,
  ManagedSpecialBarcode,
  ManagedUser,
  SpecialBarcodeType
} from './master-data-types';

type ActiveTab = 'users' | 'defects' | 'lines' | 'special';

const roleLabels: Record<Role, string> = {
  INSPECTOR: '检验员',
  QUERY: '查询用户',
  ADMIN: '管理员'
};

const tabs: Array<{ key: ActiveTab; label: string }> = [
  { key: 'users', label: '用户' },
  { key: 'defects', label: '缺陷原因' },
  { key: 'lines', label: '产线' },
  { key: 'special', label: '特殊条码' }
];

export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [defectReasons, setDefectReasons] = useState<ManagedDefectReason[]>([]);
  const [productionLines, setProductionLines] = useState<ManagedProductionLine[]>([]);
  const [specialBarcodes, setSpecialBarcodes] = useState<ManagedSpecialBarcode[]>([]);
  const [status, setStatus] = useState<{ variant: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isDefectFormOpen, setIsDefectFormOpen] = useState(false);
  const [isLineFormOpen, setIsLineFormOpen] = useState(false);
  const [specialFormType, setSpecialFormType] = useState<SpecialBarcodeType | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [nextUsers, nextDefectReasons, nextProductionLines, nextSpecialBarcodes] = await Promise.all([
        fetchManagedUsers(),
        fetchManagedDefectReasons(),
        fetchManagedProductionLines(),
        fetchManagedSpecialBarcodes()
      ]);
      setUsers(nextUsers);
      setDefectReasons(nextDefectReasons);
      setProductionLines(nextProductionLines);
      setSpecialBarcodes(nextSpecialBarcodes);
    } catch (error) {
      setStatus({ variant: 'error', message: errorMessage(error, '基础数据加载失败') });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUsers() {
    setUsers(await fetchManagedUsers());
  }

  async function refreshDefectReasons() {
    setDefectReasons(await fetchManagedDefectReasons());
  }

  async function refreshProductionLines() {
    setProductionLines(await fetchManagedProductionLines());
  }

  async function refreshSpecialBarcodes() {
    setSpecialBarcodes(await fetchManagedSpecialBarcodes());
  }

  return (
    <section className="master-data-page" aria-labelledby="module-title">
      <div className="master-data-header">
        <div>
          <h1 id="module-title">基础数据管理</h1>
          <p>维护用户、缺陷原因和产线，保护已产生的检验历史。</p>
        </div>
        {activeTab === 'users' ? (
          <Button type="button" onClick={() => setIsUserFormOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            新增用户
          </Button>
        ) : activeTab === 'defects' ? (
          <Button type="button" onClick={() => setIsDefectFormOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            新增缺陷原因
          </Button>
        ) : activeTab === 'lines' ? (
          <Button type="button" onClick={() => setIsLineFormOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            新增产线
          </Button>
        ) : activeTab === 'special' ? (
          <div className="row-actions">
            <Button type="button" onClick={() => setSpecialFormType('DIRTY')}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              新增污损条码
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSpecialFormType('NO_BARCODE_PRODUCT')}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              新增无条码产品
            </Button>
          </div>
        ) : null}
      </div>

      <div className="master-tabs" role="tablist" aria-label="基础数据分类">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={['master-tabs__button', activeTab === tab.key ? 'master-tabs__button--active' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {status ? <Alert variant={status.variant}>{status.message}</Alert> : null}
      {isLoading ? <Alert>基础数据加载中...</Alert> : null}

      {activeTab === 'users' ? (
        <UsersTable users={users} onReset={setResetTarget} />
      ) : activeTab === 'defects' ? (
        <DefectReasonsTable reasons={defectReasons} />
      ) : activeTab === 'lines' ? (
        <ProductionLinesTable lines={productionLines} />
      ) : (
        <SpecialBarcodesTable
          specialBarcodes={specialBarcodes}
          onToggleActive={async (item) => {
            try {
              await updateSpecialBarcode(item.id, { isActive: !item.isActive });
              setStatus({ variant: 'success', message: item.isActive ? '特殊条码已停用' : '特殊条码已启用' });
              await refreshSpecialBarcodes();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '特殊条码状态更新失败') });
            }
          }}
          onDelete={async (item) => {
            try {
              await deleteSpecialBarcode(item.id);
              setStatus({ variant: 'success', message: '特殊条码已删除' });
              await refreshSpecialBarcodes();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '特殊条码删除失败') });
            }
          }}
        />
      )}

      {isUserFormOpen ? (
        <CreateUserPanel
          onClose={() => setIsUserFormOpen(false)}
          onCreated={async () => {
            setStatus({ variant: 'success', message: '用户已保存' });
            setIsUserFormOpen(false);
            await refreshUsers();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordPanel
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={async () => {
            setStatus({ variant: 'success', message: '密码已重置，用户下次登录需要修改密码' });
            setResetTarget(null);
            await refreshUsers();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {isDefectFormOpen ? (
        <CreateDefectReasonPanel
          onClose={() => setIsDefectFormOpen(false)}
          onCreated={async () => {
            setStatus({ variant: 'success', message: '缺陷原因已保存' });
            setIsDefectFormOpen(false);
            await refreshDefectReasons();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {isLineFormOpen ? (
        <CreateProductionLinePanel
          onClose={() => setIsLineFormOpen(false)}
          onCreated={async () => {
            setStatus({ variant: 'success', message: '产线已保存' });
            setIsLineFormOpen(false);
            await refreshProductionLines();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {specialFormType ? (
        <CreateSpecialBarcodePanel
          type={specialFormType}
          defectReasons={defectReasons}
          onClose={() => setSpecialFormType(null)}
          onCreated={async () => {
            setStatus({ variant: 'success', message: '特殊条码已保存' });
            setSpecialFormType(null);
            await refreshSpecialBarcodes();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}
    </section>
  );
}

function UsersTable({ users, onReset }: { users: ManagedUser[]; onReset: (user: ManagedUser) => void }) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>角色</th>
            <th>状态</th>
            <th>保护</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{roleLabels[user.role]}</td>
              <td>
                <StatusBadge active={user.isActive} />
              </td>
              <td>{user.referenced ? '已引用' : '未引用'}</td>
              <td>
                <div className="row-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!user.canResetPassword}
                    aria-label={`重置密码 ${user.username}`}
                    onClick={() => onReset(user)}
                  >
                    <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
                    重置
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!user.canDelete}
                    aria-label={`删除用户 ${user.username}`}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefectReasonsTable({ reasons }: { reasons: ManagedDefectReason[] }) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>状态</th>
            <th>保护</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {reasons.map((reason) => (
            <tr key={reason.id}>
              <td>{reason.code}</td>
              <td>{reason.name}</td>
              <td>
                <StatusBadge active={reason.isActive} />
              </td>
              <td>{reason.referenced ? '已引用' : '未引用'}</td>
              <td>
                <div className="row-actions">
                  {reason.referenced ? <span className="operation-note">已引用，只能停用</span> : null}
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!reason.canDelete}
                    aria-label={`删除缺陷原因 ${reason.code}`}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductionLinesTable({ lines }: { lines: ManagedProductionLine[] }) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>排序</th>
            <th>状态</th>
            <th>保护</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.code}</td>
              <td>{line.name}</td>
              <td>{line.sortOrder}</td>
              <td>
                <StatusBadge active={line.isActive} />
              </td>
              <td>{line.referenced ? '已引用' : '未引用'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpecialBarcodesTable({
  specialBarcodes,
  onToggleActive,
  onDelete
}: {
  specialBarcodes: ManagedSpecialBarcode[];
  onToggleActive: (item: ManagedSpecialBarcode) => void;
  onDelete: (item: ManagedSpecialBarcode) => void;
}) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>条码</th>
            <th>车型</th>
            <th>零件号/原因</th>
            <th>状态</th>
            <th>保护</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {specialBarcodes.map((item) => (
            <tr key={item.id}>
              <td>{item.type === 'DIRTY' ? '条码污损' : '无条码产品'}</td>
              <td>{item.barcode}</td>
              <td>{item.vehicleModel ?? '—'}</td>
              <td>{item.type === 'DIRTY' ? item.defectReason?.name ?? '未配置' : item.partNumber}</td>
              <td>
                <StatusBadge active={item.isActive} />
              </td>
              <td>{item.referenced ? '已引用' : '未引用'}</td>
              <td>
                <div className="row-actions">
                  {item.referenced ? <span className="operation-note">已引用，只能停用</span> : null}
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${item.isActive ? '停用' : '启用'}特殊条码 ${item.barcode}`}
                    onClick={() => onToggleActive(item)}
                  >
                    {item.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!item.canDelete}
                    aria-label={`删除特殊条码 ${item.barcode}`}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateUserPanel({
  onClose,
  onCreated,
  onError
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('INSPECTOR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createManagedUser({
        username,
        password,
        role,
        isActive: true
      });
      await onCreated();
    } catch (error) {
      onError(errorMessage(error, '用户保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title="新增用户" onClose={onClose}>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="用户名" value={username} onChange={(event) => setUsername(event.target.value)} />
        <TextInput
          label="初始密码"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Select label="角色" value={role} onChange={(event) => setRole(event.target.value as Role)}>
          <option value="INSPECTOR">检验员</option>
          <option value="QUERY">查询用户</option>
          <option value="ADMIN">管理员</option>
        </Select>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存用户
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function ResetPasswordPanel({
  user,
  onClose,
  onReset,
  onError
}: {
  user: ManagedUser;
  onClose: () => void;
  onReset: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => `重置密码：${user.username}`, [user.username]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await resetManagedUserPassword(user.id, password);
      await onReset();
    } catch (error) {
      onError(errorMessage(error, '密码重置失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose}>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="新密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="重置中">
            确认重置
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function CreateDefectReasonPanel({
  onClose,
  onCreated,
  onError
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createDefectReason({ code, name, isActive: true });
      await onCreated();
    } catch (error) {
      onError(errorMessage(error, '缺陷原因保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title="新增缺陷原因" onClose={onClose}>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="缺陷编码" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextInput label="缺陷名称" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存缺陷原因
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function CreateProductionLinePanel({
  onClose,
  onCreated,
  onError
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createProductionLine({
        code,
        name,
        sortOrder: Number(sortOrder),
        isActive: true
      });
      await onCreated();
    } catch (error) {
      onError(errorMessage(error, '产线保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title="新增产线" onClose={onClose}>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="产线编码" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextInput label="产线名称" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput label="排序" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存产线
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function CreateSpecialBarcodePanel({
  type,
  defectReasons,
  onClose,
  onCreated,
  onError
}: {
  type: SpecialBarcodeType;
  defectReasons: ManagedDefectReason[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [barcode, setBarcode] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dirtyReason = defectReasons.find((reason) => reason.code === 'BARCODE_DAMAGED');
  const title = type === 'DIRTY' ? '新增污损条码' : '新增无条码产品';
  const saveLabel = type === 'DIRTY' ? '保存污损条码' : '保存无条码产品';

  useEffect(() => {
    void regenerateBarcode();
  }, []);

  async function regenerateBarcode() {
    try {
      const result = await generateSpecialBarcode();
      setBarcode(result.barcode);
    } catch (error) {
      onError(errorMessage(error, '条码生成失败'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createSpecialBarcode(
        type === 'DIRTY'
          ? {
              type,
              barcode,
              defectReasonId: dirtyReason?.id,
              isActive: true
            }
          : {
              type,
              barcode,
              vehicleModel,
              partNumber,
              isActive: true
            }
      );
      await onCreated();
    } catch (error) {
      onError(errorMessage(error, '特殊条码保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose}>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="生成条码" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
        <Button type="button" variant="secondary" onClick={() => void regenerateBarcode()}>
          重新生成
        </Button>
        {type === 'DIRTY' ? (
          <Alert variant={dirtyReason ? 'info' : 'error'}>
            {dirtyReason ? `固定缺陷原因：${dirtyReason.name}` : '缺少“条码污损”缺陷原因，无法保存'}
          </Alert>
        ) : (
          <>
            <TextInput label="车型" value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} />
            <TextInput label="零件号" value={partNumber} onChange={(event) => setPartNumber(event.target.value)} />
          </>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中" disabled={type === 'DIRTY' && !dirtyReason}>
            {saveLabel}
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function FormPanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="form-panel" role="dialog" aria-modal="true" aria-label={title}>
      <div className="form-panel__header">
        <h2>{title}</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={['status-badge', active ? 'status-badge--active' : 'status-badge--inactive'].join(' ')}>{active ? '启用' : '停用'}</span>;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  return fallback;
}
