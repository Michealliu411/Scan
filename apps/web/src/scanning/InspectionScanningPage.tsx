import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, extractApiMessage } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import {
  fetchDefectReasons,
  fetchTodayRecords,
  lookupBarcode,
  searchOperators,
  submitInspectionRecord
} from './scanning-api';
import {
  DefectReasonOption,
  DuplicateQualifiedDetails,
  InspectionDetailRecord,
  InspectionResult,
  OperatorOption,
  ResolvedPart
} from './scanning-types';

type LookupStatus = 'idle' | 'loading' | 'success' | 'error';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type InspectionMode = 'neutral' | 'unqualified';
type ScanLayoutPreset = 'standard' | 'details-first' | 'actions-first';

const lookupFailureMessage = '未找到零件信息，请修改后重试或重新扫描';
const duplicateQualifiedMessage = '该条码已存在合格记录，不能重复提交';
const workstationLayoutKey = 'scan.workstationLayout';
const scanLayoutPresets: Array<{ value: ScanLayoutPreset; label: string }> = [
  { value: 'standard', label: '标准' },
  { value: 'details-first', label: '明细优先' },
  { value: 'actions-first', label: '操作优先' }
];

export function InspectionScanningPage() {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [resolvedPart, setResolvedPart] = useState<ResolvedPart | null>(null);
  const [mode, setMode] = useState<InspectionMode>('neutral');
  const [selectedDefectReasonIds, setSelectedDefectReasonIds] = useState<string[]>([]);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [operatorOptions, setOperatorOptions] = useState<OperatorOption[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<OperatorOption | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateQualified, setDuplicateQualified] = useState<DuplicateQualifiedDetails | null>(null);
  const [defectReasons, setDefectReasons] = useState<DefectReasonOption[]>([]);
  const [todayRecords, setTodayRecords] = useState<InspectionDetailRecord[]>([]);
  const [layoutPreset, setLayoutPreset] = useState<ScanLayoutPreset>(() => readScanLayoutPreset());

  useEffect(() => {
    barcodeInputRef.current?.focus();
    void loadDefectReasons();
    void loadTodayRecords();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(workstationLayoutKey, layoutPreset);
  }, [layoutPreset]);

  useEffect(() => {
    if (mode !== 'unqualified' || operatorSearch.trim().length < 1) {
      setOperatorOptions([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadOperatorOptions(operatorSearch);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mode, operatorSearch]);

  async function loadDefectReasons() {
    try {
      setDefectReasons(await fetchDefectReasons());
    } catch (error) {
      setSubmitError(extractUnknownMessage(error, '缺陷原因加载失败'));
    }
  }

  async function loadTodayRecords() {
    try {
      setTodayRecords(await fetchTodayRecords());
    } catch (error) {
      setSubmitError(extractUnknownMessage(error, '今日检验明细加载失败'));
    }
  }

  async function loadOperatorOptions(query: string) {
    try {
      setOperatorOptions(await searchOperators(query));
    } catch (error) {
      setSubmitError(extractUnknownMessage(error, '操作工检索失败'));
    }
  }

  function handleBarcodeChange(nextBarcode: string) {
    setBarcode(nextBarcode);
    if (resolvedPart) {
      resetScanState();
    }
  }

  function handleClearScan() {
    setBarcode('');
    resetScanState();
    barcodeInputRef.current?.focus();
  }

  function resetScanState() {
    setResolvedPart(null);
    setLookupStatus('idle');
    setLookupError(null);
    setSubmitStatus('idle');
    setSubmitError(null);
    setSuccessMessage(null);
    setDuplicateQualified(null);
    setMode('neutral');
    setSelectedDefectReasonIds([]);
    setOperatorSearch('');
    setOperatorOptions([]);
    setSelectedOperator(null);
  }

  async function handleLookup() {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || lookupStatus === 'loading') {
      return;
    }

    setLookupStatus('loading');
    setLookupError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setDuplicateQualified(null);
    setSubmitStatus('idle');

    try {
      const result = await lookupBarcode(trimmedBarcode);
      if (result.kind === 'DIRTY_BARCODE_AUTO_SUBMITTED') {
        setSubmitStatus('success');
        setSuccessMessage('条码污损记录已自动提交');
        setBarcode('');
        setResolvedPart(null);
        setLookupStatus('idle');
        setMode('neutral');
        setSelectedDefectReasonIds([]);
        await loadTodayRecords();
        barcodeInputRef.current?.focus();
        return;
      }

      setResolvedPart({
        barcode: result.barcode,
        partNumber: result.partNumber,
        vehicleModel: result.vehicleModel
      });
      setBarcode(result.barcode);
      setLookupStatus('success');
      if (mode !== 'unqualified') {
        await submitResolvedPart(
          {
            barcode: result.barcode,
            partNumber: result.partNumber,
            vehicleModel: result.vehicleModel
          },
          'QUALIFIED'
        );
      }
    } catch (error) {
      setResolvedPart(null);
      setLookupStatus('error');
      setLookupError(extractUnknownMessage(error, lookupFailureMessage));
    }
  }

  function handleBarcodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleLookup();
    }
  }

  async function handleSubmit(result: InspectionResult) {
    if (!resolvedPart || submitStatus === 'submitting') {
      return;
    }

    await submitResolvedPart(resolvedPart, result);
  }

  async function submitResolvedPart(part: ResolvedPart, result: InspectionResult) {
    if (result === 'UNQUALIFIED' && selectedDefectReasonIds.length === 0) {
      setSubmitError('请选择至少一个缺陷原因');
      return;
    }

    setSubmitStatus('submitting');
    setSubmitError(null);
    setSuccessMessage(null);
    setDuplicateQualified(null);

    try {
      await submitInspectionRecord({
        barcode: part.barcode,
        partNumber: part.partNumber,
        vehicleModel: part.vehicleModel,
        result,
        ...(result === 'UNQUALIFIED'
          ? { defectReasonIds: selectedDefectReasonIds, operatorProfileId: selectedOperator?.id }
          : {})
      });
      setSubmitStatus('success');
      setSuccessMessage('检验记录已提交');
      setBarcode('');
      setResolvedPart(null);
      setLookupStatus('idle');
      setLookupError(null);
      setMode('neutral');
      setSelectedDefectReasonIds([]);
      setOperatorSearch('');
      setOperatorOptions([]);
      setSelectedOperator(null);
      await loadTodayRecords();
      barcodeInputRef.current?.focus();
    } catch (error) {
      setSubmitStatus('error');
      const duplicateDetails = parseDuplicateQualified(error);
      if (duplicateDetails) {
        setDuplicateQualified(duplicateDetails);
        setSubmitError(duplicateQualifiedMessage);
      } else {
        setSubmitError(extractUnknownMessage(error, '检验记录提交失败'));
      }
    }
  }

  function toggleDefectReason(reasonId: string) {
    setSelectedDefectReasonIds((current) =>
      current.includes(reasonId)
        ? current.filter((candidate) => candidate !== reasonId)
        : [...current, reasonId]
    );
    setSubmitError(null);
  }

  function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const isResolved = Boolean(resolvedPart);
  const isBusy = lookupStatus === 'loading' || submitStatus === 'submitting';
  const selectedDeductionAmount = useMemo(
    () =>
      selectedDefectReasonIds.reduce((total, reasonId) => {
        const reason = defectReasons.find((candidate) => candidate.id === reasonId);
        return total + (reason?.deductionAmount ?? 0);
      }, 0),
    [defectReasons, selectedDefectReasonIds]
  );
  const canSubmitUnqualified = mode === 'unqualified' && selectedDefectReasonIds.length > 0;

  return (
    <div className="scan-page">
      <div className="scan-page__header">
        <h1 id="module-title">检验扫描</h1>
        <div className="segmented-control" aria-label="扫描布局">
          {scanLayoutPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={[
                'segmented-control__button',
                layoutPreset === preset.value ? 'segmented-control__button--active' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={layoutPreset === preset.value}
              onClick={() => setLayoutPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`scan-workstation scan-workstation--${layoutPreset}`}>
        <div className="scan-workstation__item scan-workstation__item--input">
          <section className="scan-panel" aria-labelledby="scan-input-title">
            <div className="scan-panel__header">
              <h2 id="scan-input-title">条码解析</h2>
              <Button
                type="button"
                variant="secondary"
                className="scan-clear-button"
                disabled={isBusy || (!barcode && !resolvedPart)}
                onClick={handleClearScan}
              >
                清空
              </Button>
            </div>

            <form className="scan-panel__body" autoComplete="off" onSubmit={handleSubmitForm}>
              <TextInput
                ref={barcodeInputRef}
                label="条码"
                name="scan-barcode"
                autoComplete="off"
                value={barcode}
                placeholder="扫描或输入条码后按 Enter"
                onChange={(event) => handleBarcodeChange(event.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                disabled={isBusy}
              />

              {lookupStatus === 'loading' ? <Alert>正在解析条码...</Alert> : null}
              {lookupError ? <Alert variant="error">{lookupError}</Alert> : null}

              {resolvedPart ? (
                <div className="scan-resolved" aria-label="已解析零件信息">
                  <div className="scan-resolved__label">已解析零件信息</div>
                  <div>
                    <div className="scan-resolved__caption">零件号</div>
                    <div className="scan-part-number">{resolvedPart.partNumber}</div>
                  </div>
                  <div>
                    <div className="scan-resolved__caption">车型</div>
                    <div className="scan-vehicle-model">{resolvedPart.vehicleModel}</div>
                  </div>
                  <div className="scan-resolved__barcode">条码 {resolvedPart.barcode}</div>
                </div>
              ) : null}
            </form>
          </section>
        </div>

        <div className="scan-workstation__item scan-workstation__item--actions">
          <section className="scan-actions scan-actions--matched-input" aria-labelledby="scan-actions-title">
            <div className="scan-panel__header">
              <h2 id="scan-actions-title">检验操作</h2>
            </div>

            <div className="scan-action-buttons scan-action-buttons--two-wide">
              <Button
                type="button"
                variant="secondary"
                className={['scan-action-button', mode === 'unqualified' ? 'button--selected' : '']
                  .filter(Boolean)
                  .join(' ')}
                disabled={isBusy}
                onClick={() => {
                  setMode('unqualified');
                  setSubmitStatus('idle');
                  setSubmitError(null);
                  setDuplicateQualified(null);
                }}
              >
                不合格
              </Button>
              <Button
                type="button"
                variant="danger"
                className="scan-action-button"
                disabled={!isResolved || isBusy || !canSubmitUnqualified}
                loading={submitStatus === 'submitting' && mode === 'unqualified'}
                loadingLabel="提交中"
                onClick={() => void handleSubmit('UNQUALIFIED')}
              >
                提交
              </Button>
            </div>

            {mode === 'unqualified' ? (
              <>
                <div className="operator-picker">
                  <TextInput
                    label="人员选择"
                    value={operatorSearch}
                    placeholder="输入姓名或拼音首字母"
                    onChange={(event) => {
                      setOperatorSearch(event.target.value);
                      setSelectedOperator(null);
                    }}
                  />
                  {selectedOperator ? (
                    <div className="operator-picker__selected">
                      已选 {selectedOperator.name} · {selectedOperator.employmentType === 'FORMAL' ? '正式工' : '劳务工'}
                    </div>
                  ) : null}
                  {operatorOptions.length ? (
                    <div className="operator-picker__options" role="listbox" aria-label="操作工检索结果">
                      {operatorOptions.map((operator) => (
                        <button
                          key={operator.id}
                          type="button"
                          className="operator-picker__option"
                          onClick={() => {
                            setSelectedOperator(operator);
                            setOperatorSearch(operator.name);
                            setOperatorOptions([]);
                            setSubmitError(null);
                          }}
                        >
                          <span>{operator.name}</span>
                          <span>{operator.pinyinInitials} · {operator.employmentType === 'FORMAL' ? '正式工' : '劳务工'}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="defect-reasons">
                  <div className="defect-reasons__title">
                    <span>选择缺陷原因</span>
                    <strong>扣款合计 {selectedDeductionAmount.toFixed(2)}</strong>
                  </div>
                  <div className="defect-reasons__grid">
                    {defectReasons.map((reason) => (
                      <label
                        key={reason.id}
                        aria-label={`${reason.code} ${reason.name}`}
                        className={[
                          'defect-reason',
                          selectedDefectReasonIds.includes(reason.id) ? 'defect-reason--selected' : ''
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDefectReasonIds.includes(reason.id)}
                          onChange={() => toggleDefectReason(reason.id)}
                        />
                        <span>{reason.code} {reason.name}</span>
                        <strong>{reason.deductionAmount ? reason.deductionAmount.toFixed(2) : '0.00'}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {submitStatus === 'success' && successMessage ? <Alert variant="success">{successMessage}</Alert> : null}
            {submitError ? (
              <Alert variant="error">
                <div>{submitError}</div>
                {duplicateQualified ? (
                  <div className="duplicate-details">
                    <span>时间 {formatScanTime(duplicateQualified.scannedAt)}</span>
                    <span>产线 {duplicateQualified.productionLineName}</span>
                    <span>检验员 {duplicateQualified.inspectorUsername}</span>
                  </div>
                ) : null}
              </Alert>
            ) : null}
          </section>
        </div>

        <section className="scan-details scan-workstation__item scan-workstation__item--details" aria-labelledby="scan-details-title">
          <div className="scan-panel__header">
            <h2 id="scan-details-title">今日检验明细</h2>
          </div>

          {todayRecords.length ? (
            <div className="scan-detail-list">
              {todayRecords.map((record) => (
                <article className="scan-detail-row" key={record.id}>
                  <div className="scan-detail-row__time">{formatScanTime(record.scannedAt)}</div>
                  <div className="scan-detail-row__main">
                    <div className="scan-detail-row__barcode">{record.barcode}</div>
                    <div className="scan-detail-row__meta">
                      <span>{record.partNumber}</span>
                      <span>{record.vehicleModel || '未记录车型'}</span>
                    </div>
                    <div className="scan-detail-row__reasons">
                      {record.defectReasons.length ? record.defectReasons.join('、') : '无缺陷原因'}
                    </div>
                    {record.operatorProfile ? (
                      <div className="scan-detail-row__operator">
                        操作工 {record.operatorProfile.name} · 扣款 {(record.deductionAmount ?? 0).toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                  <span className={`result-badge result-badge--${record.result.toLowerCase()}`}>
                    {record.result === 'QUALIFIED' ? '合格' : '不合格'}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="scan-empty">
              <div className="scan-empty__title">今日暂无检验记录</div>
              <p>扫描条码并提交结果后，记录会显示在这里。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function readScanLayoutPreset(): ScanLayoutPreset {
  if (typeof window === 'undefined') {
    return 'standard';
  }

  const stored = window.localStorage.getItem(workstationLayoutKey);
  return stored === 'details-first' || stored === 'actions-first' || stored === 'standard' ? stored : 'standard';
}

function extractUnknownMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  if (isPayloadError(error)) {
    return extractApiMessage(error.payload) ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function parseDuplicateQualified(error: unknown): DuplicateQualifiedDetails | null {
  const payload = error instanceof ApiError ? error.payload : isPayloadError(error) ? error.payload : undefined;

  if (!payload || typeof payload !== 'object' || !('code' in payload)) {
    return null;
  }

  if (payload.code !== 'QUALIFIED_BARCODE_DUPLICATE' || !('existingRecord' in payload)) {
    return null;
  }

  const existingRecord = payload.existingRecord;
  if (!existingRecord || typeof existingRecord !== 'object') {
    return null;
  }

  const scannedAt = readString(existingRecord, 'scannedAt');
  const productionLine = readObject(existingRecord, 'productionLine');
  const inspector = readObject(existingRecord, 'inspector');
  const productionLineName = productionLine ? readString(productionLine, 'name') : undefined;
  const inspectorUsername = inspector ? readString(inspector, 'username') : undefined;

  if (!scannedAt || !productionLineName || !inspectorUsername) {
    return null;
  }

  return {
    scannedAt,
    productionLineName,
    inspectorUsername
  };
}

function isPayloadError(error: unknown): error is { payload: unknown } {
  return Boolean(error && typeof error === 'object' && 'payload' in error);
}

function readObject(source: object, key: string): object | undefined {
  const value = source[key as keyof typeof source];
  return value && typeof value === 'object' ? value : undefined;
}

function readString(source: object, key: string): string | undefined {
  const value = source[key as keyof typeof source];
  return typeof value === 'string' ? value : undefined;
}

function formatScanTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value));
}
