import { KeyRound, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, extractApiMessage } from '../api/client';
import { Role } from '../auth/auth-types';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import {
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  createDefectReason,
  createOperatorProfile,
  updateDefectReason,
  updateOperatorProfile,
  deleteDefectReason,
  deleteOperatorProfile,
  createProductionLine,
  updateProductionLine,
  deleteProductionLine,
  fetchManagedDefectReasons,
  fetchManagedOperators,
  fetchManagedProductionLines,
  fetchManagedSpecialBarcodes,
  fetchManagedUsers,
  generateSpecialBarcode,
  createSpecialBarcode,
  importOperatorProfiles,
  updateSpecialBarcode,
  deleteSpecialBarcode,
  resetManagedUserPassword
} from './master-data-api';
import {
  ManagedDefectReason,
  ManagedOperatorProfile,
  ManagedProductionLine,
  ManagedSpecialBarcode,
  ManagedUser,
  OperatorEmploymentType,
  SpecialBarcodeType
} from './master-data-types';

type ActiveTab = 'users' | 'defects' | 'operators' | 'lines' | 'special';

const roleLabels: Record<Role, string> = {
  INSPECTOR: '检验员',
  QUERY: '查询用户',
  ADMIN: '管理员'
};

const tabs: Array<{ key: ActiveTab; label: string }> = [
  { key: 'users', label: '用户' },
  { key: 'defects', label: '缺陷原因' },
  { key: 'operators', label: '操作工' },
  { key: 'lines', label: '产线' },
  { key: 'special', label: '特殊条码' }
];

const employmentTypeLabels: Record<OperatorEmploymentType, string> = {
  FORMAL: '正式工',
  LABOR: '劳务工'
};

export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [defectReasons, setDefectReasons] = useState<ManagedDefectReason[]>([]);
  const [operators, setOperators] = useState<ManagedOperatorProfile[]>([]);
  const [productionLines, setProductionLines] = useState<ManagedProductionLine[]>([]);
  const [specialBarcodes, setSpecialBarcodes] = useState<ManagedSpecialBarcode[]>([]);
  const [status, setStatus] = useState<{ variant: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isDefectFormOpen, setIsDefectFormOpen] = useState(false);
  const [isOperatorFormOpen, setIsOperatorFormOpen] = useState(false);
  const [isLineFormOpen, setIsLineFormOpen] = useState(false);
  const [specialFormType, setSpecialFormType] = useState<SpecialBarcodeType | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [editUserTarget, setEditUserTarget] = useState<ManagedUser | null>(null);
  const [editDefectTarget, setEditDefectTarget] = useState<ManagedDefectReason | null>(null);
  const [editOperatorTarget, setEditOperatorTarget] = useState<ManagedOperatorProfile | null>(null);
  const [editLineTarget, setEditLineTarget] = useState<ManagedProductionLine | null>(null);
  const [editSpecialTarget, setEditSpecialTarget] = useState<ManagedSpecialBarcode | null>(null);
  const [searchTextByTab, setSearchTextByTab] = useState<Record<ActiveTab, string>>({
    users: '',
    defects: '',
    operators: '',
    lines: '',
    special: ''
  });

  const activeSearchText = searchTextByTab[activeTab];
  const filteredUsers = useMemo(() => filterUsers(users, searchTextByTab.users), [users, searchTextByTab.users]);
  const filteredDefectReasons = useMemo(
    () => filterDefectReasons(defectReasons, searchTextByTab.defects),
    [defectReasons, searchTextByTab.defects]
  );
  const filteredOperators = useMemo(
    () => filterOperators(operators, searchTextByTab.operators),
    [operators, searchTextByTab.operators]
  );
  const filteredProductionLines = useMemo(
    () => filterProductionLines(productionLines, searchTextByTab.lines),
    [productionLines, searchTextByTab.lines]
  );
  const filteredSpecialBarcodes = useMemo(
    () => filterSpecialBarcodes(specialBarcodes, searchTextByTab.special),
    [specialBarcodes, searchTextByTab.special]
  );

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    const [nextUsers, nextDefectReasons, nextOperators, nextProductionLines, nextSpecialBarcodes] = await Promise.all([
      fetchManagedUsers().catch(() => []),
      fetchManagedDefectReasons().catch(() => []),
      safeFetchManagedOperators(),
      fetchManagedProductionLines().catch(() => []),
      fetchManagedSpecialBarcodes().catch(() => [])
    ]);

    setUsers(nextUsers);
    setDefectReasons(nextDefectReasons);
    setOperators(nextOperators);
    setProductionLines(nextProductionLines);
    setSpecialBarcodes(nextSpecialBarcodes);
    setIsLoading(false);
  }

  async function refreshUsers() {
    setUsers(await fetchManagedUsers());
  }

  async function refreshDefectReasons() {
    setDefectReasons(await fetchManagedDefectReasons());
  }

  async function refreshOperators() {
    setOperators(await fetchManagedOperators());
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
        ) : activeTab === 'operators' ? (
          <OperatorHeaderActions
            onCreate={() => setIsOperatorFormOpen(true)}
            onImport={async (rows) => {
              try {
                const result = await importOperatorProfiles(rows);
                setStatus({ variant: 'success', message: `操作工导入完成：新增${result.created}人，更新${result.updated}人` });
                await refreshOperators();
              } catch (error) {
                setStatus({ variant: 'error', message: errorMessage(error, '操作工导入失败') });
              }
            }}
            onError={(message) => setStatus({ variant: 'error', message })}
          />
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

      <MasterDataSearch
        activeTab={activeTab}
        value={activeSearchText}
        onChange={(value) => setSearchTextByTab((current) => ({ ...current, [activeTab]: value }))}
      />

      {activeTab === 'users' ? (
        <UsersTable
          users={filteredUsers}
          onEdit={setEditUserTarget}
          onReset={setResetTarget}
          onDelete={async (user) => {
            try {
              await deleteManagedUser(user.id);
              setStatus({ variant: 'success', message: '用户已删除' });
              await refreshUsers();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '用户删除失败') });
            }
          }}
        />
      ) : activeTab === 'defects' ? (
        <DefectReasonsTable
          reasons={filteredDefectReasons}
          onEdit={setEditDefectTarget}
          onDelete={async (reason) => {
            try {
              await deleteDefectReason(reason.id);
              setStatus({ variant: 'success', message: '缺陷原因已删除' });
              await refreshDefectReasons();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '缺陷原因删除失败') });
            }
          }}
          onToggleActive={async (reason) => {
            try {
              await updateDefectReason(reason.id, { isActive: !reason.isActive });
              setStatus({ variant: 'success', message: reason.isActive ? '缺陷原因已停用' : '缺陷原因已启用' });
              await refreshDefectReasons();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '缺陷原因状态更新失败') });
            }
          }}
        />
      ) : activeTab === 'operators' ? (
        <OperatorsTable
          operators={filteredOperators}
          onEdit={setEditOperatorTarget}
          onDelete={async (operator) => {
            try {
              await deleteOperatorProfile(operator.id);
              setStatus({ variant: 'success', message: '操作工已删除' });
              await refreshOperators();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '操作工删除失败') });
            }
          }}
          onToggleActive={async (operator) => {
            try {
              await updateOperatorProfile(operator.id, { isActive: !operator.isActive });
              setStatus({ variant: 'success', message: operator.isActive ? '操作工已停用' : '操作工已启用' });
              await refreshOperators();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '操作工状态更新失败') });
            }
          }}
        />
      ) : activeTab === 'lines' ? (
        <ProductionLinesTable
          lines={filteredProductionLines}
          onEdit={setEditLineTarget}
          onDelete={async (line) => {
            try {
              await deleteProductionLine(line.id);
              setStatus({ variant: 'success', message: '产线已删除' });
              await refreshProductionLines();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '产线删除失败') });
            }
          }}
          onToggleActive={async (line) => {
            try {
              await updateProductionLine(line.id, { isActive: !line.isActive });
              setStatus({ variant: 'success', message: line.isActive ? '产线已停用' : '产线已启用' });
              await refreshProductionLines();
            } catch (error) {
              setStatus({ variant: 'error', message: errorMessage(error, '产线状态更新失败') });
            }
          }}
        />
      ) : (
        <SpecialBarcodesTable
          specialBarcodes={filteredSpecialBarcodes}
          onEdit={setEditSpecialTarget}
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

      {editUserTarget ? (
        <EditUserPanel
          user={editUserTarget}
          onClose={() => setEditUserTarget(null)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '用户已更新' });
            setEditUserTarget(null);
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

      {editDefectTarget ? (
        <EditDefectReasonPanel
          reason={editDefectTarget}
          onClose={() => setEditDefectTarget(null)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '缺陷原因已更新' });
            setEditDefectTarget(null);
            await refreshDefectReasons();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {isOperatorFormOpen ? (
        <OperatorProfilePanel
          title="新增操作工"
          onClose={() => setIsOperatorFormOpen(false)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '操作工已保存' });
            setIsOperatorFormOpen(false);
            await refreshOperators();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}

      {editOperatorTarget ? (
        <OperatorProfilePanel
          title={`编辑操作工：${editOperatorTarget.name}`}
          operator={editOperatorTarget}
          onClose={() => setEditOperatorTarget(null)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '操作工已更新' });
            setEditOperatorTarget(null);
            await refreshOperators();
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

      {editLineTarget ? (
        <EditProductionLinePanel
          line={editLineTarget}
          onClose={() => setEditLineTarget(null)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '产线已更新' });
            setEditLineTarget(null);
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

      {editSpecialTarget ? (
        <EditSpecialBarcodePanel
          item={editSpecialTarget}
          defectReasons={defectReasons}
          onClose={() => setEditSpecialTarget(null)}
          onSaved={async () => {
            setStatus({ variant: 'success', message: '特殊条码已更新' });
            setEditSpecialTarget(null);
            await refreshSpecialBarcodes();
          }}
          onError={(message) => setStatus({ variant: 'error', message })}
        />
      ) : null}
    </section>
  );
}

function UsersTable({
  users,
  onEdit,
  onReset,
  onDelete
}: {
  users: ManagedUser[];
  onEdit: (user: ManagedUser) => void;
  onReset: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
}) {
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
                    disabled={!user.canEdit}
                    aria-label={`编辑用户 ${user.username}`}
                    onClick={() => onEdit(user)}
                  >
                    <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                    编辑
                  </Button>
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
                    onClick={() => onDelete(user)}
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

function MasterDataSearch({
  activeTab,
  value,
  onChange
}: {
  activeTab: ActiveTab;
  value: string;
  onChange: (value: string) => void;
}) {
  const placeholders: Record<ActiveTab, string> = {
    users: '用户名、角色、状态、保护',
    defects: '编码、名称、扣款金额、状态、保护',
    operators: '工号、姓名、拼音首字母、类型、状态、保护',
    lines: '编码、名称、排序、状态、保护',
    special: '类型、条码、车型、零件号、缺陷原因、状态、保护'
  };

  return (
    <div className="master-data-search">
      <Search size={16} strokeWidth={2} aria-hidden="true" />
      <TextInput
        label="查询"
        value={value}
        placeholder={placeholders[activeTab]}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DefectReasonsTable({
  reasons,
  onEdit,
  onDelete,
  onToggleActive
}: {
  reasons: ManagedDefectReason[];
  onEdit: (reason: ManagedDefectReason) => void;
  onDelete: (reason: ManagedDefectReason) => void;
  onToggleActive: (reason: ManagedDefectReason) => void;
}) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>扣款金额</th>
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
              <td>{formatMoney(reason.deductionAmount ?? 0)}</td>
              <td>
                <StatusBadge active={reason.isActive} />
              </td>
              <td>{reason.referenced ? '已引用' : '未引用'}</td>
              <td>
                <div className="row-actions">
                  {reason.referenced ? <span className="operation-note">已引用，只能停用</span> : null}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!reason.canEdit}
                    aria-label={`编辑缺陷原因 ${reason.code}`}
                    onClick={() => onEdit(reason)}
                  >
                    <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${reason.isActive ? '停用' : '启用'}缺陷原因 ${reason.code}`}
                    onClick={() => onToggleActive(reason)}
                  >
                    {reason.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!reason.canDelete}
                    aria-label={`删除缺陷原因 ${reason.code}`}
                    onClick={() => onDelete(reason)}
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

function OperatorsTable({
  operators,
  onEdit,
  onDelete,
  onToggleActive
}: {
  operators: ManagedOperatorProfile[];
  onEdit: (operator: ManagedOperatorProfile) => void;
  onDelete: (operator: ManagedOperatorProfile) => void;
  onToggleActive: (operator: ManagedOperatorProfile) => void;
}) {
  return (
    <div className="master-table-wrap">
      <table className="master-table">
        <thead>
          <tr>
            <th>工号</th>
            <th>姓名</th>
            <th>拼音首字母</th>
            <th>类型</th>
            <th>状态</th>
            <th>保护</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {operators.map((operator) => (
            <tr key={operator.id}>
              <td>{operator.employeeCode || '-'}</td>
              <td>{operator.name}</td>
              <td>{operator.pinyinInitials}</td>
              <td>{employmentTypeLabels[operator.employmentType]}</td>
              <td>
                <StatusBadge active={operator.isActive} />
              </td>
              <td>{operator.referenced ? '已引用' : '未引用'}</td>
              <td>
                <div className="row-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`编辑操作工 ${operator.name}`}
                    onClick={() => onEdit(operator)}
                  >
                    <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${operator.isActive ? '停用' : '启用'}操作工 ${operator.name}`}
                    onClick={() => onToggleActive(operator)}
                  >
                    {operator.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!operator.canDelete}
                    aria-label={`删除操作工 ${operator.name}`}
                    onClick={() => onDelete(operator)}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!operators.length ? (
            <tr>
              <td colSpan={7}>暂无操作工档案</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function OperatorHeaderActions({
  onCreate,
  onImport,
  onError
}: {
  onCreate: () => void;
  onImport: (
    rows: Array<{
      employeeCode?: string;
      name: string;
      pinyinInitials?: string;
      employmentType: OperatorEmploymentType;
      isActive?: boolean;
    }>
  ) => Promise<void>;
  onError: (message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      const rows = await readOperatorWorkbook(file);
      await onImport(rows);
    } catch (error) {
      onError(error instanceof Error ? error.message : '操作工导入失败');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="row-actions">
      <Button type="button" onClick={onCreate}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        新增操作工
      </Button>
      <Button type="button" variant="secondary" loading={isImporting} loadingLabel="导入中" onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} strokeWidth={2} aria-hidden="true" />
        Excel导入
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="visually-hidden"
        onChange={(event) => void handleImport(event)}
      />
    </div>
  );
}

function OperatorProfilePanel({
  title,
  operator,
  onClose,
  onSaved,
  onError
}: {
  title: string;
  operator?: ManagedOperatorProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [employeeCode, setEmployeeCode] = useState(operator?.employeeCode ?? '');
  const [name, setName] = useState(operator?.name ?? '');
  const [pinyinInitials, setPinyinInitials] = useState(operator?.pinyinInitials ?? '');
  const [employmentType, setEmploymentType] = useState<OperatorEmploymentType>(operator?.employmentType ?? 'FORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const input = {
        employeeCode,
        name,
        pinyinInitials,
        employmentType,
        isActive: operator?.isActive ?? true
      };

      if (operator) {
        await updateOperatorProfile(operator.id, input);
      } else {
        await createOperatorProfile(input);
      }

      await onSaved();
    } catch (error) {
      onError(errorMessage(error, '操作工保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="工号" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
        <TextInput label="姓名" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput
          label="拼音首字母（自动生成）"
          value={pinyinInitials}
          placeholder="可留空，例如马丽波自动生成 mlb"
          onChange={(event) => setPinyinInitials(event.target.value)}
        />
        <Select
          label="人员类型"
          value={employmentType}
          onChange={(event) => setEmploymentType(event.target.value as OperatorEmploymentType)}
        >
          <option value="FORMAL">正式工</option>
          <option value="LABOR">劳务工</option>
        </Select>
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存操作工
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function ProductionLinesTable({
  lines,
  onEdit,
  onDelete,
  onToggleActive
}: {
  lines: ManagedProductionLine[];
  onEdit: (line: ManagedProductionLine) => void;
  onDelete: (line: ManagedProductionLine) => void;
  onToggleActive: (line: ManagedProductionLine) => void;
}) {
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
            <th>操作</th>
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
              <td>
                <div className="row-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`编辑产线 ${line.code}`}
                    onClick={() => onEdit(line)}
                  >
                    <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${line.isActive ? '停用' : '启用'}产线 ${line.code}`}
                    onClick={() => onToggleActive(line)}
                  >
                    {line.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={!line.canDelete}
                    aria-label={`删除产线 ${line.code}`}
                    onClick={() => onDelete(line)}
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

function SpecialBarcodesTable({
  specialBarcodes,
  onEdit,
  onToggleActive,
  onDelete
}: {
  specialBarcodes: ManagedSpecialBarcode[];
  onEdit: (item: ManagedSpecialBarcode) => void;
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
                    disabled={!item.canEdit}
                    aria-label={`编辑特殊条码 ${item.barcode}`}
                    onClick={() => onEdit(item)}
                  >
                    <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                    编辑
                  </Button>
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
    <FormPanel title="新增用户" onClose={onClose} modal>
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

function EditUserPanel({
  user,
  onClose,
  onSaved,
  onError
}: {
  user: ManagedUser;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => `编辑用户：${user.username}`, [user.username]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await updateManagedUser(user.id, { role });
      await onSaved();
    } catch (error) {
      onError(errorMessage(error, '用户更新失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
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
            保存修改
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
    <FormPanel title={title} onClose={onClose} modal>
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
  const [deductionAmount, setDeductionAmount] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const amount = toMoneyNumber(deductionAmount);
      await createDefectReason({
        code,
        name,
        ...(amount > 0 ? { deductionAmount: amount } : {}),
        isActive: true
      });
      await onCreated();
    } catch (error) {
      onError(errorMessage(error, '缺陷原因保存失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title="新增缺陷原因" onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="缺陷编码" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextInput label="缺陷名称" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput
          label="扣款金额"
          type="number"
          min="0"
          step="0.01"
          value={deductionAmount}
          onChange={(event) => setDeductionAmount(event.target.value)}
        />
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

function EditDefectReasonPanel({
  reason,
  onClose,
  onSaved,
  onError
}: {
  reason: ManagedDefectReason;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(reason.name);
  const [deductionAmount, setDeductionAmount] = useState(String(reason.deductionAmount ?? 0));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => `编辑缺陷原因：${reason.code}`, [reason.code]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const amount = toMoneyNumber(deductionAmount);
      await updateDefectReason(reason.id, {
        ...(reason.referenced ? {} : { name }),
        ...(amount !== (reason.deductionAmount ?? 0) ? { deductionAmount: amount } : {})
      });
      await onSaved();
    } catch (error) {
      onError(errorMessage(error, '缺陷原因更新失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput
          label="缺陷名称"
          value={name}
          disabled={reason.referenced}
          onChange={(event) => setName(event.target.value)}
        />
        <TextInput
          label="扣款金额"
          type="number"
          min="0"
          step="0.01"
          value={deductionAmount}
          onChange={(event) => setDeductionAmount(event.target.value)}
        />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存修改
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
    <FormPanel title="新增产线" onClose={onClose} modal>
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

function EditProductionLinePanel({
  line,
  onClose,
  onSaved,
  onError
}: {
  line: ManagedProductionLine;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(line.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => `编辑产线：${line.code}`, [line.code]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProductionLine(line.id, { name });
      await onSaved();
    } catch (error) {
      onError(errorMessage(error, '产线更新失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="产线名称" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存修改
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
  const dirtyReason = defectReasons.find((reason) => reason.code === 'BARCODE_DAMAGED' && reason.isActive);
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
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        <TextInput label="生成条码" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
        <Button type="button" variant="secondary" onClick={() => void regenerateBarcode()}>
          重新生成
        </Button>
        {type === 'DIRTY' ? (
          <Alert variant="info">
            {dirtyReason ? `固定缺陷原因：${dirtyReason.name}` : '固定缺陷原因：条码污损（保存时自动恢复内置原因）'}
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
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            {saveLabel}
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function EditSpecialBarcodePanel({
  item,
  defectReasons,
  onClose,
  onSaved,
  onError
}: {
  item: ManagedSpecialBarcode;
  defectReasons: ManagedDefectReason[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [vehicleModel, setVehicleModel] = useState(item.vehicleModel ?? '');
  const [partNumber, setPartNumber] = useState(item.partNumber ?? '');
  const [defectReasonId, setDefectReasonId] = useState(item.defectReason?.id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => `编辑特殊条码：${item.barcode}`, [item.barcode]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await updateSpecialBarcode(
        item.id,
        item.type === 'DIRTY'
          ? { defectReasonId }
          : {
              vehicleModel,
              partNumber
            }
      );
      await onSaved();
    } catch (error) {
      onError(errorMessage(error, '特殊条码更新失败'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormPanel title={title} onClose={onClose} modal>
      <form className="master-form" onSubmit={handleSubmit}>
        {item.type === 'DIRTY' ? (
          <Select label="缺陷原因" value={defectReasonId} onChange={(event) => setDefectReasonId(event.target.value)}>
            {defectReasons
              .filter((reason) => reason.code === 'BARCODE_DAMAGED')
              .map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
          </Select>
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
          <Button type="submit" loading={isSubmitting} loadingLabel="保存中">
            保存修改
          </Button>
        </div>
      </form>
    </FormPanel>
  );
}

function FormPanel({
  title,
  children,
  onClose,
  modal = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  modal?: boolean;
}) {
  const panel = (
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

  return modal ? <div className="modal-backdrop">{panel}</div> : panel;
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={['status-badge', active ? 'status-badge--active' : 'status-badge--inactive'].join(' ')}>{active ? '启用' : '停用'}</span>;
}

function filterUsers(users: ManagedUser[], query: string): ManagedUser[] {
  return users.filter((user) =>
    matchesQuery(query, [
      user.username,
      roleLabels[user.role],
      statusText(user.isActive),
      referenceText(user.referenced)
    ])
  );
}

function filterDefectReasons(reasons: ManagedDefectReason[], query: string): ManagedDefectReason[] {
  return reasons.filter((reason) =>
    matchesQuery(query, [
      reason.code,
      reason.name,
      formatMoney(reason.deductionAmount ?? 0),
      statusText(reason.isActive),
      referenceText(reason.referenced)
    ])
  );
}

function filterOperators(operators: ManagedOperatorProfile[], query: string): ManagedOperatorProfile[] {
  return [...operators]
    .sort(compareOperatorsByEmployeeCode)
    .filter((operator) =>
      matchesQuery(query, [
        operator.employeeCode ?? '',
        operator.name,
        operator.pinyinInitials,
        employmentTypeLabels[operator.employmentType],
        statusText(operator.isActive),
        referenceText(operator.referenced)
      ])
    );
}

function filterProductionLines(lines: ManagedProductionLine[], query: string): ManagedProductionLine[] {
  return lines.filter((line) =>
    matchesQuery(query, [
      line.code,
      line.name,
      String(line.sortOrder),
      statusText(line.isActive),
      referenceText(line.referenced)
    ])
  );
}

function filterSpecialBarcodes(items: ManagedSpecialBarcode[], query: string): ManagedSpecialBarcode[] {
  return items.filter((item) =>
    matchesQuery(query, [
      item.type === 'DIRTY' ? '污损条码' : '无条码产品',
      item.barcode,
      item.vehicleModel ?? '',
      item.partNumber ?? '',
      item.defectReason ? `${item.defectReason.code} ${item.defectReason.name}` : '',
      statusText(item.isActive),
      referenceText(item.referenced)
    ])
  );
}

function matchesQuery(query: string, values: Array<string | number>): boolean {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return values.some((value) => String(value).toLowerCase().includes(keyword));
}

function compareOperatorsByEmployeeCode(a: ManagedOperatorProfile, b: ManagedOperatorProfile): number {
  const aCode = a.employeeCode?.trim();
  const bCode = b.employeeCode?.trim();
  if (aCode && bCode) {
    return aCode.localeCompare(bCode, 'zh-CN', { numeric: true, sensitivity: 'base' }) || a.name.localeCompare(b.name, 'zh-CN');
  }
  if (aCode) {
    return -1;
  }
  if (bCode) {
    return 1;
  }
  return a.name.localeCompare(b.name, 'zh-CN');
}

function statusText(active: boolean): string {
  return active ? '启用' : '停用';
}

function referenceText(referenced: boolean): string {
  return referenced ? '已引用' : '未引用';
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  return fallback;
}

async function safeFetchManagedOperators(): Promise<ManagedOperatorProfile[]> {
  try {
    return await fetchManagedOperators();
  } catch {
    return [];
  }
}

async function readOperatorWorkbook(file: File): Promise<
  Array<{
    employeeCode?: string;
    name: string;
    pinyinInitials?: string;
    employmentType: OperatorEmploymentType;
    isActive?: boolean;
  }>
> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel文件中没有工作表');
  }
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error('Excel文件中没有可读取的工作表');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: ''
  });

  const parsedRows = rows
    .map((row) => ({
      employeeCode: readCell(row, ['工号', '员工编号', 'employeeCode']),
      name: readCell(row, ['姓名', 'name']),
      pinyinInitials: readCell(row, ['拼音首字母', '首字母', 'pinyinInitials']),
      employmentType: parseEmploymentType(readCell(row, ['人员类型', '类型', '用工类型', 'employmentType'])),
      isActive: parseActive(readCell(row, ['状态', 'isActive']))
    }))
    .filter((row) => row.name);

  if (!parsedRows.length) {
    throw new Error('Excel中未找到可导入的操作工数据');
  }

  return parsedRows;
}

function readCell(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function parseEmploymentType(value: string): OperatorEmploymentType {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'LABOR' || value.includes('劳务')) {
    return 'LABOR';
  }

  return 'FORMAL';
}

function parseActive(value: string): boolean | undefined {
  if (!value) {
    return undefined;
  }

  return !['停用', '否', 'FALSE', 'false', '0'].includes(value.trim());
}

function toMoneyNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatMoney(value: number): string {
  return value ? value.toFixed(2) : '0.00';
}
