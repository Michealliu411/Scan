import { CalendarDays, RotateCcw, Search, Save, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, extractApiMessage } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import {
  closeDailyProductionPlan,
  createDailyProductionPlan,
  fetchDailyProductionPlans,
  fetchProductionPlanLines,
  lookupProductionOrder,
  reopenDailyProductionPlan,
  updateDailyProductionPlan
} from './production-plan-api';
import {
  DailyProductionPlan,
  DailyProductionPlanStatus,
  ProductionOrderLookup,
  ProductionLineOption,
  ProductionPlanFilters
} from './production-plan-types';

const statusLabels: Record<DailyProductionPlanStatus, string> = {
  ACTIVE: '执行中',
  CLOSED: '已关闭'
};

export function ProductionPlanPage() {
  const today = useMemo(() => getTodayDateInputValue(), []);
  const [filters, setFilters] = useState<ProductionPlanFilters>({
    date: today,
    status: 'ACTIVE',
    productionOrderNo: ''
  });
  const [plans, setPlans] = useState<DailyProductionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [lookupResult, setLookupResult] = useState<ProductionOrderLookup | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [selectedProductionLineId, setSelectedProductionLineId] = useState('');
  const [productionLines, setProductionLines] = useState<ProductionLineOption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void loadPlans(filters);
    void loadProductionLines();
  }, []);

  const totals = useMemo(() => summarizePlans(plans), [plans]);

  async function loadPlans(nextFilters = filters) {
    setIsLoading(true);
    setListError(null);

    try {
      setPlans(await fetchDailyProductionPlans(nextFilters));
    } catch (error) {
      setListError(extractUnknownMessage(error, '生产计划加载失败'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProductionLines() {
    try {
      setProductionLines(await fetchProductionPlanLines());
    } catch (error) {
      setListError(extractUnknownMessage(error, '产线加载失败'));
    }
  }

  function updateFilter(key: keyof ProductionPlanFilters, value: string) {
    setFilters({ ...filters, [key]: value });
  }

  async function handleSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await loadPlans(filters);
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || isLookingUp) {
      return;
    }

    setIsLookingUp(true);
    setFormError(null);
    setFormMessage(null);
    setLookupResult(null);

    try {
      const result = await lookupProductionOrder(trimmedBarcode);
      setLookupResult(result);
      setPlannedQuantity(String(result.orderQuantity));
    } catch (error) {
      setFormError(extractUnknownMessage(error, '生产订单查询失败'));
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleCreatePlan() {
    if (!lookupResult || isCreating) {
      return;
    }

    const nextQuantity = Number(plannedQuantity);
    if (!selectedProductionLineId) {
      setFormError('请选择计划产线');
      return;
    }

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      setFormError('今日计划数必须是正整数');
      return;
    }

    setIsCreating(true);
    setFormError(null);
    setFormMessage(null);

    try {
      await createDailyProductionPlan({
        businessDate: filters.date,
        productionOrderNo: lookupResult.productionOrderNo,
        partNumber: lookupResult.partNumber,
        productName: lookupResult.productName,
        productionLineId: selectedProductionLineId,
        orderQuantity: lookupResult.orderQuantity,
        plannedQuantity: nextQuantity
      });
      setFormMessage('生产计划已下达');
      setBarcode('');
      setLookupResult(null);
      setPlannedQuantity('');
      await loadPlans(filters);
    } catch (error) {
      setFormError(extractUnknownMessage(error, '生产计划下达失败'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(planId: string, nextQuantity: number, productionLineId: string) {
    await updateDailyProductionPlan(planId, { plannedQuantity: nextQuantity, productionLineId });
    await loadPlans(filters);
  }

  async function handleClose(planId: string) {
    await closeDailyProductionPlan(planId);
    await loadPlans(filters);
  }

  async function handleReopen(planId: string) {
    await reopenDailyProductionPlan(planId);
    await loadPlans(filters);
  }

  return (
    <section className="production-plan-page" aria-labelledby="module-title">
      <header className="query-header">
        <div>
          <h1 id="module-title">生产计划</h1>
          <p>按生产订单下达日计划，并跟踪当日完成状态。</p>
        </div>
      </header>

      <div className="plan-summary" aria-label="计划概览">
        <PlanMetric label="计划订单" value={plans.length} />
        <PlanMetric label="今日计划数" value={totals.plannedQuantity} />
        <PlanMetric label="合格完成" value={totals.qualifiedCount} />
        <PlanMetric label="剩余计划" value={totals.remainingQuantity} />
      </div>

      <div className="plan-workspace">
        <section className="plan-panel plan-entry-panel" aria-labelledby="plan-create-title">
          <div className="scan-panel__header">
            <h2 id="plan-create-title">下达日计划</h2>
          </div>
          <form className="master-form" onSubmit={handleLookup}>
            {formError ? <Alert variant="error">{formError}</Alert> : null}
            {formMessage ? <Alert variant="success">{formMessage}</Alert> : null}
            <Select
              label="计划产线"
              value={selectedProductionLineId}
              onChange={(event) => setSelectedProductionLineId(event.target.value)}
            >
              <option value="">请选择产线</option>
              {productionLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </Select>
            <TextInput
              label="水洗条码"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
            <Button type="submit" loading={isLookingUp} loadingLabel="查询中">
              <Search size={16} strokeWidth={2} aria-hidden="true" />
              查询订单
            </Button>
          </form>
        </section>

        {lookupResult ? (
          <aside className="plan-panel plan-order-panel" aria-label="生产订单信息">
            <div className="scan-panel__header">
              <h2>生产订单信息</h2>
            </div>
            <div className="plan-order-preview">
              <div>
                <span>生产订单</span>
                <strong>{lookupResult.productionOrderNo}</strong>
              </div>
              <div>
                <span>零件号</span>
                <strong>{lookupResult.partNumber}</strong>
              </div>
              <div>
                <span>产品名称</span>
                <strong>{lookupResult.productName}</strong>
              </div>
              <div>
                <span>订单数量</span>
                <strong>{lookupResult.orderQuantity}</strong>
              </div>
            </div>
            <div className="plan-submit-row">
              <TextInput
                label="今日计划数"
                type="number"
                min={1}
                value={plannedQuantity}
                onChange={(event) => setPlannedQuantity(event.target.value)}
              />
              <Button
                type="button"
                className="plan-submit-button"
                loading={isCreating}
                loadingLabel="下达中"
                onClick={() => void handleCreatePlan()}
              >
                <Save size={16} strokeWidth={2} aria-hidden="true" />
                下达订单
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      <section className="query-section" aria-label="生产计划列表">
        {listError ? <Alert variant="error">{listError}</Alert> : null}
        <form className="query-filter-grid" onSubmit={handleSearch}>
          <TextInput
            label="计划日期"
            type="date"
            value={filters.date ?? ''}
            onChange={(event) => updateFilter('date', event.target.value)}
          />
          <Select
            label="状态"
            value={filters.status ?? ''}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">全部</option>
            <option value="ACTIVE">执行中</option>
            <option value="CLOSED">已关闭</option>
          </Select>
          <TextInput
            label="生产订单"
            value={filters.productionOrderNo ?? ''}
            onChange={(event) => updateFilter('productionOrderNo', event.target.value)}
          />
          <div className="query-filter-actions">
            <Button type="submit" loading={isLoading} loadingLabel="查询中">
              <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
              查询计划
            </Button>
          </div>
        </form>

        <DailyPlanTable
          plans={plans}
          productionLines={productionLines}
          onUpdate={handleUpdate}
          onClose={handleClose}
          onReopen={handleReopen}
          onError={(message) => setListError(message)}
        />
      </section>
    </section>
  );
}

function DailyPlanTable({
  plans,
  productionLines,
  onUpdate,
  onClose,
  onReopen,
  onError
}: {
  plans: DailyProductionPlan[];
  productionLines: ProductionLineOption[];
  onUpdate: (planId: string, plannedQuantity: number, productionLineId: string) => Promise<void>;
  onClose: (planId: string) => Promise<void>;
  onReopen: (planId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="master-table-wrap">
      <table className="master-table plan-table" aria-label="生产计划列表">
        <thead>
          <tr>
            <th>状态</th>
            <th>生产订单</th>
            <th>产品</th>
            <th>订单数量</th>
            <th>今日计划</th>
            <th>合格/不合格</th>
            <th>剩余</th>
            <th>完成率</th>
            <th>产线</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {plans.length ? (
            plans.map((plan) => (
              <DailyPlanRow
                key={plan.id}
                plan={plan}
                productionLines={productionLines}
                onUpdate={onUpdate}
                onClose={onClose}
                onReopen={onReopen}
                onError={onError}
              />
            ))
          ) : (
            <tr>
              <td colSpan={10}>没有符合条件的生产计划</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DailyPlanRow({
  plan,
  productionLines,
  onUpdate,
  onClose,
  onReopen,
  onError
}: {
  plan: DailyProductionPlan;
  productionLines: ProductionLineOption[];
  onUpdate: (planId: string, plannedQuantity: number, productionLineId: string) => Promise<void>;
  onClose: (planId: string) => Promise<void>;
  onReopen: (planId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [draftQuantity, setDraftQuantity] = useState(String(plan.plannedQuantity));
  const [draftProductionLineId, setDraftProductionLineId] = useState(plan.productionLine.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const isClosed = plan.status === 'CLOSED';
  const completionPercent = Math.round(plan.completionRate * 1000) / 10;

  useEffect(() => {
    setDraftQuantity(String(plan.plannedQuantity));
    setDraftProductionLineId(plan.productionLine.id);
  }, [plan.plannedQuantity, plan.productionLine.id]);

  async function saveQuantity() {
    const nextQuantity = Number(draftQuantity);
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      onError('今日计划数必须是正整数');
      return;
    }

    if (!draftProductionLineId) {
      onError('请选择计划产线');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(plan.id, nextQuantity, draftProductionLineId);
    } catch (error) {
      onError(extractUnknownMessage(error, '计划数调整失败'));
    } finally {
      setIsSaving(false);
    }
  }

  async function closePlan() {
    setIsClosing(true);
    try {
      await onClose(plan.id);
    } catch (error) {
      onError(extractUnknownMessage(error, '关闭计划失败'));
    } finally {
      setIsClosing(false);
    }
  }

  async function reopenPlan() {
    setIsReopening(true);
    try {
      await onReopen(plan.id);
    } catch (error) {
      onError(extractUnknownMessage(error, '重新打开计划失败'));
    } finally {
      setIsReopening(false);
    }
  }

  return (
    <tr>
      <td>
        <span className={['status-badge', isClosed ? 'status-badge--inactive' : 'status-badge--active'].join(' ')}>
          {statusLabels[plan.status]}
        </span>
      </td>
      <td className="query-breakable">
        {plan.productionOrderNo}
        <span className="table-subtext">{plan.businessDate}</span>
      </td>
      <td>
        {plan.productName}
        <span className="table-subtext">{plan.partNumber}</span>
      </td>
      <td>{plan.orderQuantity}</td>
      <td>
        <input
          className="plan-quantity-input"
          type="number"
          min={1}
          value={draftQuantity}
          disabled={isClosed || isSaving}
          onChange={(event) => setDraftQuantity(event.target.value)}
          aria-label={`${plan.productionOrderNo} 今日计划数`}
        />
      </td>
      <td>{plan.qualifiedCount} / {plan.unqualifiedCount}</td>
      <td>{plan.remainingQuantity}</td>
      <td>{completionPercent}%</td>
      <td>
        <select
          className="select-input plan-line-select"
          value={draftProductionLineId}
          disabled={isClosed || isSaving}
          onChange={(event) => setDraftProductionLineId(event.target.value)}
          aria-label={`${plan.productionOrderNo} 计划产线`}
        >
          <option value="">请选择产线</option>
          {productionLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <div className="row-actions">
          <Button type="button" variant="secondary" disabled={isClosed} loading={isSaving} loadingLabel="保存" onClick={() => void saveQuantity()}>
            <Save size={16} strokeWidth={2} aria-hidden="true" />
            保存
          </Button>
          {isClosed ? (
            <Button type="button" variant="ghost" loading={isReopening} loadingLabel="打开中" onClick={() => void reopenPlan()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              重新打开
            </Button>
          ) : (
            <Button type="button" variant="ghost" loading={isClosing} loadingLabel="关闭" onClick={() => void closePlan()}>
              <XCircle size={16} strokeWidth={2} aria-hidden="true" />
              关闭
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PlanMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="query-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function summarizePlans(plans: DailyProductionPlan[]) {
  return plans.reduce(
    (total, plan) => ({
      plannedQuantity: total.plannedQuantity + plan.plannedQuantity,
      qualifiedCount: total.qualifiedCount + plan.qualifiedCount,
      remainingQuantity: total.remainingQuantity + plan.remainingQuantity
    }),
    {
      plannedQuantity: 0,
      qualifiedCount: 0,
      remainingQuantity: 0
    }
  );
}

function getTodayDateInputValue(): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

function extractUnknownMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (hasApiErrorCode(error.payload, 'SCAN_LOOKUP_NOT_FOUND')) {
      return '未查询到该标签对应的生产订单，请确认标签是否正确，或上游系统是否已生成该生产订单。';
    }

    return extractApiMessage(error.payload) ?? fallback;
  }

  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') {
      return '无法连接系统接口，请确认当前页面使用 192.168.1.144:8080 打开，并检查 API 服务是否正常。';
    }

    return error.message;
  }

  return fallback;
}

function hasApiErrorCode(payload: unknown, code: string): boolean {
  return Boolean(payload && typeof payload === 'object' && 'code' in payload && payload.code === code);
}
