import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductionOrderScanLookupService } from './production-order-scan-lookup.service';

describe('ProductionOrderScanLookupService', () => {
  const lookupUrl = 'http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai';
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the lookup URL from config and maps JsonData into scan part information', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 200,
        Message: '查询成功！',
        JsonData: {
          成品零件编号: '88460CC280',
          成品产品名称: "KIA PVC款乘客靠背UXC COVER'G ASSY-FR SEAT BACK,RH"
        }
      })
    );
    const service = new ProductionOrderScanLookupService(
      configService({ SCAN_LOOKUP_URL: lookupUrl })
    );

    await expect(service.lookup(' SHUIXI-001 ')).resolves.toEqual({
      barcode: 'SHUIXI-001',
      partNumber: '88460CC280',
      vehicleModel: "KIA PVC款乘客靠背UXC COVER'G ASSY-FR SEAT BACK,RH",
      source: 'PRODUCTION_ORDER_LOOKUP'
    });

    expect(fetchMock).toHaveBeenCalledWith(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Code: 'SHUIXI-001' })
    });
  });

  it('uses the built-in intranet lookup URL when config is not set', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 200,
        JsonData: {
          成品零件编号: 'PN-001',
          成品产品名称: '产品名称'
        }
      })
    );
    const service = new ProductionOrderScanLookupService(configService({}));

    await service.lookup('CODE-001');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai',
      expect.any(Object)
    );
  });

  it('returns the normal not-found scan error when the external API does not return success', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 500,
        Message: '查询失败'
      })
    );
    const service = new ProductionOrderScanLookupService(configService({ SCAN_LOOKUP_URL: lookupUrl }));

    await expect(service.lookup('UNKNOWN-001')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a gateway error when the configured service is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const service = new ProductionOrderScanLookupService(configService({ SCAN_LOOKUP_URL: lookupUrl }));

    await expect(service.lookup('CODE-001')).rejects.toBeInstanceOf(BadGatewayException);
  });
});

function configService(values: Record<string, string>): ConfigService {
  return {
    get(key: string, defaultValue?: string) {
      return values[key] ?? defaultValue;
    }
  } as ConfigService;
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
