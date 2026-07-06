export const SCAN_LOOKUP_GATEWAY = 'SCAN_LOOKUP_GATEWAY';

export type ScanLookupResult = {
  barcode: string;
  partNumber: string;
  vehicleModel: string;
  productionOrderNo?: string;
  orderQuantity?: number;
  rawData?: unknown;
  source?: 'SIMULATED_LOOKUP' | 'NO_BARCODE_PRODUCT' | 'PRODUCTION_ORDER_LOOKUP';
};

export interface ScanLookupGateway {
  lookup(barcode: string): Promise<ScanLookupResult>;
}
