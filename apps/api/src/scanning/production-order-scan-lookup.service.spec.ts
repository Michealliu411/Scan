import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductionOrderScanLookupService } from './production-order-scan-lookup.service';

describe('ProductionOrderScanLookupService', () => {
  const lookupUrl = 'http://kdportal.kuangdacn.com/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai';
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
          生产订单号: 'PO-20260605-001',
          成品零件编号: '88460CC280',
          成品产品名称: "KIA PVC款乘客靠背UXC COVER'G ASSY-FR SEAT BACK,RH",
          成品车型: 'KIA UXC',
          成品品名: '乘客靠背座套',
          订单数量: '320'
        }
      })
    );
    const service = new ProductionOrderScanLookupService(
      configService({ SCAN_LOOKUP_URL: lookupUrl })
    );

    const result = await service.lookup(' SHUIXI-001 ');

    expect(result).toMatchObject({
      barcode: 'SHUIXI-001',
      partNumber: '88460CC280',
      productName: "KIA PVC款乘客靠背UXC COVER'G ASSY-FR SEAT BACK,RH",
      vehicleModel: 'KIA UXC',
      partName: '乘客靠背座套',
      productionOrderNo: 'PO-20260605-001',
      orderQuantity: 320,
      source: 'PRODUCTION_ORDER_LOOKUP'
    });
    expect(result.rawData).toMatchObject({
      生产订单号: 'PO-20260605-001',
      成品零件编号: '88460CC280',
      成品产品名称: "KIA PVC款乘客靠背UXC COVER'G ASSY-FR SEAT BACK,RH",
      订单数量: '320'
    });

    expect(fetchMock).toHaveBeenCalledWith(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Code: 'SHUIXI-001' })
    });
  });

  it('maps the live intranet lookup response fields into scan part information', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 200,
        Message: '查询成功！',
        生产订单ID: 16444,
        生产订单UUID: '6e3bcb1d-3ef9-415a-ad39-11b4d316a333',
        生产订单编号: 'MO202606050008',
        生产订单单据日期: 46179.0,
        成品零件ID: 618255,
        成品零件编号: '3GB881405KNUB',
        成品产品名称: 'Passat B8 WL-Trendline配置驾驶座面套(基本型)',
        成品车型: 'Passat B8',
        成品品名: '驾驶座面套',
        JsonData: {
          id: 2850338,
          生产订单ID: 16444,
          UUID: '6e3bcb1d-3ef9-415a-ad39-11b4d316a333',
          生产订单编号: 'MO202606050008',
          生产订单单据日期: '2026-06-06T00:00:00',
          成品零件编号: '3GB881405KNUB',
          成品产品名称: 'Passat B8 WL-Trendline配置驾驶座面套(基本型)',
          成品车型: 'Passat B8',
          成品品名: '驾驶座面套',
          生产订单数量: 280,
          成品零件ID: 618255
        }
      })
    );
    const service = new ProductionOrderScanLookupService(
      configService({ SCAN_LOOKUP_URL: lookupUrl })
    );

    const result = await service.lookup('3GB881405KNUB 02ST660SKDC17');

    expect(result).toMatchObject({
      barcode: '3GB881405KNUB 02ST660SKDC17',
      partNumber: '3GB881405KNUB',
      productName: 'Passat B8 WL-Trendline配置驾驶座面套(基本型)',
      vehicleModel: 'Passat B8',
      partName: '驾驶座面套',
      productionOrderNo: 'MO202606050008',
      orderQuantity: 280,
      source: 'PRODUCTION_ORDER_LOOKUP'
    });
    expect(result.rawData).toMatchObject({
      id: 2850338,
      生产订单ID: 16444,
      UUID: '6e3bcb1d-3ef9-415a-ad39-11b4d316a333',
      生产订单编号: 'MO202606050008',
      生产订单单据日期: '2026-06-06T00:00:00',
      成品零件编号: '3GB881405KNUB',
      成品产品名称: 'Passat B8 WL-Trendline配置驾驶座面套(基本型)',
      生产订单数量: 280,
      成品零件ID: 618255
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
      'http://kdportal.kuangdacn.com/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai',
      expect.any(Object)
    );
  });

  it('keeps vehicle model and part name empty when the successful interface response does not provide them', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 200,
        JsonData: {
          成品零件编号: 'PN-EMPTY-METADATA',
          成品产品名称: '仅原始产品名称'
        }
      })
    );
    const service = new ProductionOrderScanLookupService(configService({ SCAN_LOOKUP_URL: lookupUrl }));

    await expect(service.lookup('CODE-EMPTY-METADATA')).resolves.toMatchObject({
      barcode: 'CODE-EMPTY-METADATA',
      partNumber: 'PN-EMPTY-METADATA',
      productName: '仅原始产品名称',
      vehicleModel: null,
      partName: null
    });
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
