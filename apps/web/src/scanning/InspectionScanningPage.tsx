import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ApiError, extractApiMessage } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import {
  fetchDefectReasons,
  fetchTodayRecords,
  lookupBarcode,
  submitInspectionRecord
} from './scanning-api';
import {
  DefectReasonOption,
  DuplicateQualifiedDetails,
  InspectionDetailRecord,
  InspectionResult,
  ResolvedPart
} from './scanning-types';

type LookupStatus = 'idle' | 'loading' | 'success' | 'error';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type InspectionMode = 'neutral' | 'unqualified';

const lookupFailureMessage = '未找到零件信息，请修改后重试或重新扫描';
const duplicateQualifiedMessage = '该条码已存在合格记录，不能重复提交';

export function InspectionScanningPage() {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [resolvedPart, setResolvedPart] = useState<ResolvedPart | null>(null);
  const [mode, setMode] = useState<InspectionMode>('neutral');
  const [selectedDefectReasonIds, setSelectedDefectReasonIds] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateQualified, setDuplicateQualified] = useState<DuplicateQualifiedDetails | null>(null);
  const [defectReasons, setDefectReasons] = useState<DefectReasonOption[]>([]);
  const [todayRecords, setTodayRecords] = useState<InspectionDetailRecord[]>([]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
    void loadDefectReasons();
    void loadTodayRecords();
  }, []);

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

  function handleBarcodeChange(nextBarcode: string) {
    setBarcode(nextBarcode);
    if (resolvedPart) {
      setResolvedPart(null);
      setLookupStatus('idle');
      setLookupError(null);
      setSubmitStatus('idle');
      setSubmitError(null);
      setDuplicateQualified(null);
      setMode('neutral');
      setSelectedDefectReasonIds([]);
    }
  }

  async function handleLookup() {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode || lookupStatus === 'loading') {
      return;
    }

    setLookupStatus('loading');
    setLookupError(null);
    setSubmitError(null);
    setDuplicateQualified(null);
    setSubmitStatus('idle');

    try {
      const result = await lookupBarcode(trimmedBarcode);
      setResolvedPart(result);
      setBarcode(result.barcode);
      setLookupStatus('success');
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

    if (result === 'UNQUALIFIED' && selectedDefectReasonIds.length === 0) {
      setSubmitError('请选择至少一个缺陷原因');
      return;
    }

    setSubmitStatus('submitting');
    setSubmitError(null);
    setDuplicateQualified(null);

    try {
      await submitInspectionRecord({
        barcode: resolvedPart.barcode,
        partNumber: resolvedPart.partNumber,
        vehicleModel: resolvedPart.vehicleModel,
        result,
        ...(result === 'UNQUALIFIED' ? { defectReasonIds: selectedDefectReasonIds } : {})
      });
      setSubmitStatus('success');
      setBarcode('');
      setResolvedPart(null);
      setLookupStatus('idle');
      setLookupError(null);
      setMode('neutral');
      setSelectedDefectReasonIds([]);
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
  const canSubmitUnqualified = mode === 'unqualified' && selectedDefectReasonIds.length > 0;

  return (
    <div className="scan-page">
      <h1 id="module-title">检验扫描</h1>

      <div className="scan-workstation">
        <div className="scan-workstation__left">
          <section className="scan-panel" aria-labelledby="scan-input-title">
            <div className="scan-panel__header">
              <h2 id="scan-input-title">条码解析</h2>
            </div>

            <form className="scan-panel__body" onSubmit={handleSubmitForm}>
              <TextInput
                ref={barcodeInputRef}
                label="条码"
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

          <section className="scan-actions" aria-labelledby="scan-actions-title">
            <div className="scan-panel__header">
              <h2 id="scan-actions-title">检验操作</h2>
            </div>

            <div className="scan-action-buttons">
              <Button
                type="button"
                disabled={!isResolved || isBusy}
                loading={submitStatus === 'submitting' && mode === 'neutral'}
                loadingLabel="提交中"
                onClick={() => void handleSubmit('QUALIFIED')}
              >
                合格
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={mode === 'unqualified' ? 'button--selected' : undefined}
                disabled={!isResolved || isBusy}
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
                disabled={!isResolved || isBusy || !canSubmitUnqualified}
                loading={submitStatus === 'submitting' && mode === 'unqualified'}
                loadingLabel="提交中"
                onClick={() => void handleSubmit('UNQUALIFIED')}
              >
                提交
              </Button>
            </div>

            {mode === 'unqualified' ? (
              <div className="defect-reasons">
                <div className="defect-reasons__title">选择缺陷原因</div>
                <div className="defect-reasons__grid">
                  {defectReasons.map((reason) => (
                    <label
                      key={reason.id}
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
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {submitStatus === 'success' ? <Alert variant="success">检验记录已提交</Alert> : null}
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

        <section className="scan-details" aria-labelledby="scan-details-title">
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
