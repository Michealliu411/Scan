import * as echarts from 'echarts';
import { BarChart3, Download, Maximize2, Minimize2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import {
  fetchDashboard,
  fetchInspectionRecordChangeLogs,
  fetchDetailRecords,
  fetchQueryDefectReasons,
  fetchQueryProductionLines,
  reclassifyInspectionRecord,
  updateUnqualifiedRecordReasons
} from './query-api';
import {
  ChangeLogFilters,
  DashboardFilters,
  DashboardResponse,
  DefectReasonOption,
  DetailQueryFilters,
  DetailRecord,
  InspectionRecordChangeLog,
  InspectionResult,
  ProductionLineOption
} from './query-types';

type QueryTab = 'dashboard' | 'details' | 'logs';

const resultLabels: Record<InspectionResult, string> = {
  QUALIFIED: '合格',
  UNQUALIFIED: '不合格'
};

export function QueryAnalysisPage() {
  const [activeTab, setActiveTab] = useState<QueryTab>('dashboard');
  const [productionLines, setProductionLines] = useState<ProductionLineOption[]>([]);
  const [defectReasons, setDefectReasons] = useState<DefectReasonOption[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>({});
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [detailFilters, setDetailFilters] = useState<DetailQueryFilters>({
    startDate: getTodayDateInputValue(),
    endDate: getTodayDateInputValue(),
    productionLineId: '',
    barcode: '',
    partNumber: '',
    result: '',
    defectReasonId: '',
    page: 1,
    pageSize: 50
  });
  const [detailRecords, setDetailRecords] = useState<DetailRecord[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [changeLogFilters, setChangeLogFilters] = useState<ChangeLogFilters>({
    startDate: getTodayDateInputValue(),
    endDate: getTodayDateInputValue(),
    barcode: '',
    operatorUsername: '',
    page: 1,
    pageSize: 50
  });
  const [changeLogs, setChangeLogs] = useState<InspectionRecordChangeLog[]>([]);
  const [changeLogTotal, setChangeLogTotal] = useState(0);
  const [changeLogLoading, setChangeLogLoading] = useState(false);
  const [changeLogError, setChangeLogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [lineOptions, reasonOptions] = await Promise.all([
          fetchQueryProductionLines(),
          fetchQueryDefectReasons()
        ]);

        if (!cancelled) {
          setProductionLines(lineOptions);
          setDefectReasons(reasonOptions);
        }
      } catch {
        if (!cancelled) {
          setDashboardError('筛选项加载失败，请刷新后重试');
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError(null);

      try {
        const nextDashboard = await fetchDashboard(dashboardFilters);
        if (!cancelled) {
          setDashboard(nextDashboard);
        }
      } catch {
        if (!cancelled) {
          setDashboardError('统计看板加载失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [dashboardFilters]);

  async function handleDetailSearch(nextFilters = detailFilters) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetchDetailRecords(nextFilters);
      setDetailRecords(response.records);
      setDetailTotal(response.total);
    } catch {
      setDetailError('明细查询失败，请检查筛选条件后重试');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleChangeLogSearch(nextFilters = changeLogFilters) {
    setChangeLogLoading(true);
    setChangeLogError(null);

    try {
      const response = await fetchInspectionRecordChangeLogs(nextFilters);
      setChangeLogs(response.logs);
      setChangeLogTotal(response.total);
    } catch {
      setChangeLogError('操作记录查询失败，请检查筛选条件后重试');
    } finally {
      setChangeLogLoading(false);
    }
  }

  async function handleReclassify(recordId: string, defectReasonIds: string[]) {
    setDetailError(null);

    try {
      await reclassifyInspectionRecord(recordId, defectReasonIds);
      await handleDetailSearch();
    } catch {
      setDetailError('变更为不合格失败，请确认记录状态和缺陷原因');
    }
  }

  async function handleUpdateUnqualifiedReasons(recordId: string, defectReasonIds: string[]) {
    setDetailError(null);

    try {
      await updateUnqualifiedRecordReasons(recordId, defectReasonIds);
      await handleDetailSearch();
    } catch {
      setDetailError('修改不合格原因失败，请确认记录状态和缺陷原因');
    }
  }

  return (
    <section className="query-page" aria-labelledby="module-title">
      <header className="query-header">
        <div>
          <h1 id="module-title">查询分析</h1>
          <p>按北京自然月查看产出统计，并检索检验明细。</p>
        </div>
      </header>

      <div className="master-tabs" role="tablist" aria-label="查询分析视图">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          className={['master-tabs__button', activeTab === 'dashboard' ? 'master-tabs__button--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('dashboard')}
        >
          统计看板
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          className={['master-tabs__button', activeTab === 'details' ? 'master-tabs__button--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('details')}
        >
          明细查询
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'logs'}
          className={['master-tabs__button', activeTab === 'logs' ? 'master-tabs__button--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('logs')}
        >
          操作记录
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <DashboardTab
          dashboard={dashboard}
          dashboardError={dashboardError}
          dashboardLoading={dashboardLoading}
          productionLines={productionLines}
          selectedProductionLineId={dashboardFilters.productionLineId ?? ''}
          onProductionLineChange={(productionLineId) =>
            setDashboardFilters(productionLineId ? { productionLineId } : {})
          }
          onExport={() => exportDashboard(dashboard)}
        />
      ) : activeTab === 'details' ? (
        <DetailQueryTab
          defectReasons={defectReasons}
          detailError={detailError}
          detailFilters={detailFilters}
          detailLoading={detailLoading}
          detailRecords={detailRecords}
          detailTotal={detailTotal}
          productionLines={productionLines}
          onFilterChange={setDetailFilters}
          onSearch={handleDetailSearch}
          onPageSearch={(filters) => {
            setDetailFilters(filters);
            void handleDetailSearch(filters);
          }}
          onExport={() => exportDetailRecords(detailRecords)}
          onReclassify={handleReclassify}
          onUpdateUnqualifiedReasons={handleUpdateUnqualifiedReasons}
        />
      ) : (
        <ChangeLogTab
          changeLogError={changeLogError}
          changeLogFilters={changeLogFilters}
          changeLogLoading={changeLogLoading}
          changeLogs={changeLogs}
          changeLogTotal={changeLogTotal}
          onFilterChange={setChangeLogFilters}
          onSearch={handleChangeLogSearch}
          onPageSearch={(filters) => {
            setChangeLogFilters(filters);
            void handleChangeLogSearch(filters);
          }}
          onExport={() => exportChangeLogs(changeLogs)}
        />
      )}
    </section>
  );
}

function DashboardTab({
  dashboard,
  dashboardError,
  dashboardLoading,
  productionLines,
  selectedProductionLineId,
  onProductionLineChange,
  onExport
}: {
  dashboard: DashboardResponse | null;
  dashboardError: string | null;
  dashboardLoading: boolean;
  productionLines: ProductionLineOption[];
  selectedProductionLineId: string;
  onProductionLineChange: (productionLineId: string) => void;
  onExport: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const productChartOption = useMemo(
    (): echarts.EChartsOption => ({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dashboard?.productDistribution.map((item) => item.partNumber) ?? [] },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: dashboard?.productDistribution.map((item) => item.total) ?? []
        }
      ]
    }),
    [dashboard]
  );
  const unqualifiedChartOption = useMemo(
    (): echarts.EChartsOption => ({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dashboard?.unqualifiedPartDistribution.map((item) => item.partNumber) ?? [] },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: dashboard?.unqualifiedPartDistribution.map((item) => item.unqualified) ?? []
        }
      ]
    }),
    [dashboard]
  );
  const productionLineChartOption = useMemo(
    (): echarts.EChartsOption => ({
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['总产出', '合格数', '不合格数'],
        bottom: 0
      },
      grid: {
        left: 40,
        right: 20,
        top: 52,
        bottom: 64,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dashboard?.productionLineTotals.map((line) => line.productionLineCode) ?? []
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '总产出',
          type: 'bar',
          data: dashboard?.productionLineTotals.map((line) => line.total) ?? []
        },
        {
          name: '合格数',
          type: 'bar',
          data: dashboard?.productionLineTotals.map((line) => line.qualified) ?? []
        },
        {
          name: '不合格数',
          type: 'bar',
          data: dashboard?.productionLineTotals.map((line) => line.unqualified) ?? []
        }
      ]
    }),
    [dashboard]
  );

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const resizeTimer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);

    return () => {
      window.clearTimeout(resizeTimer);
    };
  }, [isFullscreen]);

  return (
    <section
      className={[
        'query-section',
        isFullscreen ? 'query-section--fullscreen query-section--fullscreen-fit' : ''
      ].filter(Boolean).join(' ')}
      aria-label="统计看板内容"
    >
      <div className="query-toolbar">
        <div className="query-period">{dashboard ? `${dashboard.period.year}年${dashboard.period.month}月` : '当前月份'}</div>
        <div className="query-toolbar__actions">
          <Select
            label="产线筛选"
            value={selectedProductionLineId}
            onChange={(event) => onProductionLineChange(event.target.value)}
          >
            <option value="">全部产线</option>
            {productionLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.code} {line.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={!dashboard}
            onClick={onExport}
          >
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            导出Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-pressed={isFullscreen}
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? (
              <Minimize2 size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} strokeWidth={2} aria-hidden="true" />
            )}
            {isFullscreen ? '退出全屏' : '全屏看板'}
          </Button>
        </div>
      </div>

      {dashboardError ? <Alert variant="error">{dashboardError}</Alert> : null}
      {dashboardLoading ? <p className="muted-text">正在加载统计数据...</p> : null}

      <div className="query-kpi-grid" aria-label="月度指标">
        <KpiTile label="总产出" value={dashboard?.workshopTotals.total ?? 0} />
        <KpiTile label="合格数" value={dashboard?.workshopTotals.qualified ?? 0} />
        <KpiTile label="不合格数" value={dashboard?.workshopTotals.unqualified ?? 0} />
      </div>

      <ChartPanel
        title="产线统计"
        empty={!dashboard?.productionLineTotals.length}
        option={productionLineChartOption}
        size="wide"
      />

      <div className="query-chart-grid">
        <ChartPanel
          title="产品分布"
          empty={!dashboard?.productDistribution.length}
          option={productChartOption}
        />
        <ChartPanel
          title="不合格零件分布"
          empty={!dashboard?.unqualifiedPartDistribution.length}
          option={unqualifiedChartOption}
        />
      </div>
    </section>
  );
}

function DetailQueryTab({
  defectReasons,
  detailError,
  detailFilters,
  detailLoading,
  detailRecords,
  detailTotal,
  productionLines,
  onFilterChange,
  onSearch,
  onPageSearch,
  onExport,
  onReclassify,
  onUpdateUnqualifiedReasons
}: {
  defectReasons: DefectReasonOption[];
  detailError: string | null;
  detailFilters: DetailQueryFilters;
  detailLoading: boolean;
  detailRecords: DetailRecord[];
  detailTotal: number;
  productionLines: ProductionLineOption[];
  onFilterChange: (filters: DetailQueryFilters) => void;
  onSearch: () => void;
  onPageSearch: (filters: DetailQueryFilters) => void;
  onExport: () => void;
  onReclassify: (recordId: string, defectReasonIds: string[]) => Promise<void>;
  onUpdateUnqualifiedReasons: (recordId: string, defectReasonIds: string[]) => Promise<void>;
}) {
  const [reasonDialog, setReasonDialog] = useState<{ mode: 'reclassify' | 'update'; record: DetailRecord } | null>(null);
  const [selectedReasonIds, setSelectedReasonIds] = useState<string[]>([]);
  const [isSavingReasons, setIsSavingReasons] = useState(false);

  function updateFilter(key: keyof DetailQueryFilters, value: string) {
    onFilterChange({ ...detailFilters, [key]: value, page: 1 });
  }

  function openReclassifyDialog(record: DetailRecord) {
    setReasonDialog({ mode: 'reclassify', record });
    setSelectedReasonIds([]);
  }

  function openUpdateReasonsDialog(record: DetailRecord) {
    setReasonDialog({ mode: 'update', record });
    setSelectedReasonIds(record.defectReasons.map((reason) => reason.id));
  }

  function toggleReclassifyReason(reasonId: string) {
    setSelectedReasonIds((current) =>
      current.includes(reasonId)
        ? current.filter((candidate) => candidate !== reasonId)
        : [...current, reasonId]
    );
  }

  async function submitReasonDialog() {
    if (!reasonDialog || !selectedReasonIds.length) {
      return;
    }

    setIsSavingReasons(true);
    try {
      if (reasonDialog.mode === 'reclassify') {
        await onReclassify(reasonDialog.record.id, selectedReasonIds);
      } else {
        await onUpdateUnqualifiedReasons(reasonDialog.record.id, selectedReasonIds);
      }
      setReasonDialog(null);
      setSelectedReasonIds([]);
    } finally {
      setIsSavingReasons(false);
    }
  }

  return (
    <section className="query-section" aria-label="明细查询内容">
      {detailError ? <Alert variant="error">{detailError}</Alert> : null}

      <form
        className="query-filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <TextInput
          label="开始日期"
          type="date"
          value={detailFilters.startDate ?? ''}
          onChange={(event) => updateFilter('startDate', event.target.value)}
        />
        <TextInput
          label="结束日期"
          type="date"
          value={detailFilters.endDate ?? ''}
          onChange={(event) => updateFilter('endDate', event.target.value)}
        />
        <Select
          label="产线"
          value={detailFilters.productionLineId ?? ''}
          onChange={(event) => updateFilter('productionLineId', event.target.value)}
        >
          <option value="">全部产线</option>
          {productionLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.code} {line.name}
            </option>
          ))}
        </Select>
        <TextInput
          label="条码"
          value={detailFilters.barcode ?? ''}
          onChange={(event) => updateFilter('barcode', event.target.value)}
        />
        <TextInput
          label="零件号"
          value={detailFilters.partNumber ?? ''}
          onChange={(event) => updateFilter('partNumber', event.target.value)}
        />
        <Select
          label="结果"
          value={detailFilters.result ?? ''}
          onChange={(event) => updateFilter('result', event.target.value)}
        >
          <option value="">全部</option>
          <option value="QUALIFIED">合格</option>
          <option value="UNQUALIFIED">不合格</option>
        </Select>
        <Select
          label="缺陷原因"
          value={detailFilters.defectReasonId ?? ''}
          onChange={(event) => updateFilter('defectReasonId', event.target.value)}
        >
          <option value="">全部缺陷原因</option>
          {defectReasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.code} {reason.name}
            </option>
          ))}
        </Select>
        <div className="query-filter-actions">
          <Button type="submit" loading={detailLoading} loadingLabel="查询中...">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            查询
          </Button>
          <Button type="button" variant="secondary" disabled={!detailRecords.length} onClick={onExport}>
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            导出Excel
          </Button>
        </div>
      </form>

      <div className="master-table-wrap">
        <table className="master-table query-detail-table" aria-label="明细查询结果">
          <thead>
            <tr>
              <th>扫码时间</th>
              <th>产线</th>
              <th>条码</th>
              <th>车型</th>
              <th>零件号</th>
              <th>结果</th>
              <th>缺陷原因</th>
              <th>操作工</th>
              <th>扣款金额</th>
              <th>检验员</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {detailRecords.length ? (
              detailRecords.map((record) => (
                <tr key={record.id}>
                  <td>{formatScanTime(record.scannedAt)}</td>
                  <td>{record.productionLine.name}</td>
                  <td className="query-breakable">{record.barcode}</td>
                  <td>{record.vehicleModel ?? '-'}</td>
                  <td className="query-breakable">{record.partNumber}</td>
                  <td>{resultLabels[record.result]}</td>
                  <td>{record.defectReasons.map((reason) => reason.name).join('、') || '-'}</td>
                  <td>{record.operatorProfile?.name ?? '-'}</td>
                  <td>{(record.deductionAmount ?? 0).toFixed(2)}</td>
                  <td>{record.inspector.username}</td>
                  <td>
                    {record.result === 'QUALIFIED' ? (
                      <Button type="button" variant="secondary" onClick={() => openReclassifyDialog(record)}>
                        变更为不合格
                      </Button>
                    ) : record.result === 'UNQUALIFIED' ? (
                      <Button type="button" variant="secondary" onClick={() => openUpdateReasonsDialog(record)}>
                        修改原因
                      </Button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11}>没有符合条件的记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={detailFilters.page ?? 1}
        pageSize={detailFilters.pageSize ?? 50}
        total={detailTotal}
        onPageChange={(page) => onPageSearch({ ...detailFilters, page })}
        onPageSizeChange={(pageSize) => onPageSearch({ ...detailFilters, page: 1, pageSize })}
      />

      {reasonDialog ? (
        <div className="modal-backdrop">
          <div
            className="form-panel reason-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${reasonDialog.mode === 'reclassify' ? '变更为不合格' : '修改不合格原因'}：${reasonDialog.record.barcode}`}
          >
            <div className="reason-dialog__header">
              <h2>{reasonDialog.mode === 'reclassify' ? '变更为不合格' : '修改不合格原因'}</h2>
              <p className="muted-text">{reasonDialog.record.barcode} · {reasonDialog.record.partNumber}</p>
            </div>
            <div className="defect-reasons reason-dialog__body">
              <div className="defect-reasons__title">选择缺陷原因</div>
              <div className="defect-reasons__grid">
                {defectReasons.map((reason) => (
                  <label
                    key={reason.id}
                    className={[
                      'defect-reason',
                      selectedReasonIds.includes(reason.id) ? 'defect-reason--selected' : ''
                    ].filter(Boolean).join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={selectedReasonIds.includes(reason.id)}
                      onChange={() => toggleReclassifyReason(reason.id)}
                    />
                    <span>{reason.code} {reason.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <Button type="button" variant="secondary" disabled={isSavingReasons} onClick={() => setReasonDialog(null)}>
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!selectedReasonIds.length || isSavingReasons}
                loading={isSavingReasons}
                loadingLabel="保存中..."
                onClick={() => void submitReasonDialog()}
              >
                {reasonDialog.mode === 'reclassify' ? '确认变更' : '保存原因'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChangeLogTab({
  changeLogError,
  changeLogFilters,
  changeLogLoading,
  changeLogs,
  changeLogTotal,
  onFilterChange,
  onSearch,
  onPageSearch,
  onExport
}: {
  changeLogError: string | null;
  changeLogFilters: ChangeLogFilters;
  changeLogLoading: boolean;
  changeLogs: InspectionRecordChangeLog[];
  changeLogTotal: number;
  onFilterChange: (filters: ChangeLogFilters) => void;
  onSearch: () => void;
  onPageSearch: (filters: ChangeLogFilters) => void;
  onExport: () => void;
}) {
  function updateFilter(key: keyof ChangeLogFilters, value: string) {
    onFilterChange({ ...changeLogFilters, [key]: value, page: 1 });
  }

  return (
    <section className="query-section" aria-label="操作记录内容">
      {changeLogError ? <Alert variant="error">{changeLogError}</Alert> : null}

      <form
        className="query-filter-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <TextInput
          label="开始日期"
          type="date"
          value={changeLogFilters.startDate ?? ''}
          onChange={(event) => updateFilter('startDate', event.target.value)}
        />
        <TextInput
          label="结束日期"
          type="date"
          value={changeLogFilters.endDate ?? ''}
          onChange={(event) => updateFilter('endDate', event.target.value)}
        />
        <TextInput
          label="条码"
          value={changeLogFilters.barcode ?? ''}
          onChange={(event) => updateFilter('barcode', event.target.value)}
        />
        <TextInput
          label="操作人"
          value={changeLogFilters.operatorUsername ?? ''}
          onChange={(event) => updateFilter('operatorUsername', event.target.value)}
        />
        <div className="query-filter-actions">
          <Button type="submit" loading={changeLogLoading} loadingLabel="查询中...">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            查询操作记录
          </Button>
          <Button type="button" variant="secondary" disabled={!changeLogs.length} onClick={onExport}>
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            导出Excel
          </Button>
        </div>
      </form>

      <div className="master-table-wrap">
        <table className="master-table query-detail-table" aria-label="操作记录查询结果">
          <thead>
            <tr>
              <th>操作时间</th>
              <th>条码</th>
              <th>零件号</th>
              <th>变更</th>
              <th>缺陷原因</th>
              <th>操作人</th>
            </tr>
          </thead>
          <tbody>
            {changeLogs.length ? (
              changeLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatScanTime(log.operatedAt)}</td>
                  <td className="query-breakable">{log.barcode ?? '-'}</td>
                  <td className="query-breakable">{log.partNumber ?? '-'}</td>
                  <td>{formatOperationChange(log)}</td>
                  <td>{log.defectReasons.map((reason) => reason.name).join('、') || '-'}</td>
                  <td>{log.operator.username}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>没有符合条件的操作记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={changeLogFilters.page ?? 1}
        pageSize={changeLogFilters.pageSize ?? 50}
        total={changeLogTotal}
        onPageChange={(page) => onPageSearch({ ...changeLogFilters, page })}
        onPageSizeChange={(pageSize) => onPageSearch({ ...changeLogFilters, page: 1, pageSize })}
      />
    </section>
  );
}

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);

  return (
    <div className="pagination-bar" aria-label="分页">
      <span>共 {total} 条</span>
      <Select
        label="每页数量"
        value={String(pageSize)}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {[20, 50, 100, 200].map((option) => (
          <option key={option} value={option}>
            {option} 条/页
          </option>
        ))}
      </Select>
      <div className="row-actions">
        <Button type="button" variant="secondary" disabled={clampedPage <= 1} onClick={() => onPageChange(clampedPage - 1)}>
          上一页
        </Button>
        <span>{clampedPage} / {totalPages}</span>
        <Button type="button" variant="secondary" disabled={clampedPage >= totalPages} onClick={() => onPageChange(clampedPage + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="query-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartPanel({
  title,
  empty,
  option,
  size = 'standard'
}: {
  title: string;
  empty: boolean;
  option: echarts.EChartsOption;
  size?: 'standard' | 'wide';
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    const chart = echarts.init(chartRef.current);
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [option]);

  return (
    <section className={['query-chart', size === 'wide' ? 'query-chart--wide' : ''].filter(Boolean).join(' ')} aria-label={title}>
      <header className="query-chart__header">
        <h2>{title}</h2>
        <BarChart3 size={18} strokeWidth={2} aria-hidden="true" />
      </header>
      <div ref={chartRef} className="query-chart__canvas" aria-hidden="true" />
      {empty ? <p className="query-chart__empty">本月暂无数据</p> : null}
    </section>
  );
}

function formatScanTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(new Date(value));
}

function formatOperationChange(log: InspectionRecordChangeLog): string {
  if (log.previousResult && log.newResult) {
    if (log.action === 'UPDATE_UNQUALIFIED_REASONS') {
      return '修改不合格原因';
    }
    return `${resultLabels[log.previousResult]} -> ${resultLabels[log.newResult]}`;
  }

  const actionLabels: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '编辑',
    DELETE: '删除',
    RESET_PASSWORD: '重置密码',
    IMPORT: '导入'
  };
  const targetLabels: Record<string, string> = {
    user: '用户',
    defectReason: '缺陷原因',
    operatorProfile: '操作工',
    productionLine: '产线',
    specialBarcode: '特殊条码'
  };

  return `${actionLabels[log.action] ?? log.action} ${targetLabels[log.targetType] ?? log.targetType}：${log.targetLabel}`;
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

async function exportDashboard(dashboard: DashboardResponse | null) {
  if (!dashboard) {
    return;
  }

  await writeWorkbook(`统计看板-${dashboard.period.year}-${String(dashboard.period.month).padStart(2, '0')}.xlsx`, {
    月度指标: [
      { 指标: '总产出', 数量: dashboard.workshopTotals.total },
      { 指标: '合格数', 数量: dashboard.workshopTotals.qualified },
      { 指标: '不合格数', 数量: dashboard.workshopTotals.unqualified }
    ],
    产线统计: dashboard.productionLineTotals.map((line) => ({
      产线编码: line.productionLineCode,
      产线名称: line.productionLineName,
      总产出: line.total,
      合格数: line.qualified,
      不合格数: line.unqualified
    })),
    产品分布: dashboard.productDistribution.map((item) => ({
      零件号: item.partNumber,
      数量: item.total
    })),
    不合格零件分布: dashboard.unqualifiedPartDistribution.map((item) => ({
      零件号: item.partNumber,
      不合格数: item.unqualified
    }))
  });
}

async function exportDetailRecords(records: DetailRecord[]) {
  await writeWorkbook('检验明细.xlsx', {
    检验明细: records.map((record) => ({
      扫码时间: formatScanTime(record.scannedAt),
      产线: record.productionLine.name,
      条码: record.barcode,
      车型: record.vehicleModel ?? '',
      零件号: record.partNumber,
      结果: resultLabels[record.result],
      缺陷原因: record.defectReasons.map((reason) => `${reason.code} ${reason.name}`).join('、'),
      操作工: record.operatorProfile?.name ?? '',
      操作工类型: record.operatorProfile?.employmentType === 'LABOR' ? '劳务工' : record.operatorProfile ? '正式工' : '',
      扣款金额: record.deductionAmount ?? 0,
      检验员: record.inspector.username
    }))
  });
}

async function exportChangeLogs(logs: InspectionRecordChangeLog[]) {
  await writeWorkbook('操作记录.xlsx', {
    操作记录: logs.map((log) => ({
      操作时间: formatScanTime(log.operatedAt),
      条码: log.barcode ?? '',
      零件号: log.partNumber ?? '',
      变更: formatOperationChange(log),
      缺陷原因: log.defectReasons.map((reason) => `${reason.code} ${reason.name}`).join('、'),
      操作人: log.operator.username
    }))
  });
}

async function writeWorkbook(fileName: string, sheets: Record<string, Array<Record<string, string | number>>>) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
}
