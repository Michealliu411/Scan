import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ScanLookupGateway, ScanLookupResult } from './scan-lookup.gateway';

@Injectable()
export class SimulatedScanLookupService implements ScanLookupGateway {
  async lookup(barcode: string): Promise<ScanLookupResult> {
    const trimmedBarcode = barcode.trim();

    if (!trimmedBarcode) {
      throw new BadRequestException({
        code: 'BARCODE_REQUIRED',
        message: '请输入条码'
      });
    }

    if (trimmedBarcode.toUpperCase().includes('UNKNOWN')) {
      throw new NotFoundException({
        code: 'SCAN_LOOKUP_NOT_FOUND',
        message: '未找到零件信息，请修改后重试或重新扫描'
      });
    }

    const normalized = trimmedBarcode.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const padded = normalized.padEnd(6, '0');

    return {
      barcode: trimmedBarcode,
      partNumber: `PN-${padded.slice(-6)}`,
      vehicleModel: `车型-${padded.slice(0, 4)}`
    };
  }
}
