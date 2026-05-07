import { SCAN_LOOKUP_GATEWAY, ScanLookupGateway } from './scan-lookup.gateway';
import { SimulatedScanLookupService } from './simulated-scan-lookup.service';

describe('Scan lookup gateway', () => {
  it('exposes a stable provider token for replaceable lookup implementations', () => {
    expect(SCAN_LOOKUP_GATEWAY).toBe('SCAN_LOOKUP_GATEWAY');
  });

  it('keeps the simulated lookup behind the gateway contract', async () => {
    const gateway: ScanLookupGateway = new SimulatedScanLookupService();

    await expect(gateway.lookup('ABC-123456')).resolves.toMatchObject({
      barcode: 'ABC-123456',
      partNumber: 'PN-123456',
      vehicleModel: '车型-ABC1'
    });
  });
});
