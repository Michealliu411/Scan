import * as echarts from 'echarts';
import { BarChart3, Maximize2, Minimize2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { TextInput } from '../components/TextInput';
import {
  fetchDashboard,
  fetchDetailRecords,
  fetchQueryDefectReasons,
  fetchQueryProductionLines
} from './query-api';
import {
  DashboardFilters,
  DashboardResponse,
  DefectReasonOption,
  DetailQueryFilters,
  DetailRecord,
  InspectionResult,
  ProductionLineOption
} from './query-types';

type QueryTab = 'dashboard' | 'details';

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
    startDate: '',
    endDate: '',
    productionLineId: '',
    barcode: '',
    partNumber: '',
    result: '',
    defectReasonId: ''
  });
  const [detailRecords, setDetailRecords] = useState<DetailRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  async function handleDetailSearch() {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetchDetailRecords(detailFilters);
      setDetailRecords(response.records);
    } catch {
      setDetailError('明细查询失败，请检查筛选条件后重试');
    } finally {
      setDetailLoading(false);
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
        />
      ) : (
        <DetailQueryTab
          defectReasons={defectReasons}
          detailError={detailError}
          detailFilters={detailFilters}
          detailLoading={detailLoading}
          detailRecords={detailRecords}
          productionLines={productionLines}
          onFilterChange={setDetailFilters}
          onSearch={handleDetailSearch}
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
  onProductionLineChange
}: {
  dashboard: DashboardResponse | null;
  dashboardError: string | null;
  dashboardLoading: boolean;
  productionLines: ProductionLineOption[];
  selectedProductionLineId: string;
  onProductionLineChange: (productionLineId: string) => void;
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
      className={['query-section', isFullscreen ? 'query-section--fullscreen' : ''].filter(Boolean).join(' ')}
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

      <div className="master-table-wrap">
        <table className="master-table" aria-label="产线月度统计">
          <thead>
            <tr>
              <th>产线</th>
              <th>总产出</th>
              <th>合格数</th>
              <th>不合格数</th>
            </tr>
          </thead>
          <tbody>
            {dashboard?.productionLineTotals.length ? (
              dashboard.productionLineTotals.map((line) => (
                <tr key={line.productionLineId}>
                  <td>
                    <strong>{line.productionLineCode}</strong>
                    <span className="table-subtext">{line.productionLineName}</span>
                  </td>
                  <td>{line.total}</td>
                  <td>{line.qualified}</td>
                  <td>{line.unqualified}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>本月暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
  productionLines,
  onFilterChange,
  onSearch
}: {
  defectReasons: DefectReasonOption[];
  detailError: string | null;
  detailFilters: DetailQueryFilters;
  detailLoading: boolean;
  detailRecords: DetailRecord[];
  productionLines: ProductionLineOption[];
  onFilterChange: (filters: DetailQueryFilters) => void;
  onSearch: () => void;
}) {
  function updateFilter(key: keyof DetailQueryFilters, value: string) {
    onFilterChange({ ...detailFilters, [key]: value });
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
              <th>检验员</th>
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
                  <td>{record.inspector.username}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>没有符合条件的记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
  option
}: {
  title: string;
  empty: boolean;
  option: echarts.EChartsOption;
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
    <section className="query-chart" aria-label={title}>
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
