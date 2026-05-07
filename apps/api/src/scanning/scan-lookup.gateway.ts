export const SCAN_LOOKUP_GATEWAY = 'SCAN_LOOKUP_GATEWAY';

export type ScanLookupResult = {
  barcode: string;
  partNumber: string;
  vehicleModel: string;
};

export interface ScanLookupGateway {
  lookup(barcode: string): Promise<ScanLookupResult>;
}
