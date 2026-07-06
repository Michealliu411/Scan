import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanLookupGateway, ScanLookupResult } from './scan-lookup.gateway';

const defaultLookupUrl =
  'http://192.168.1.151/ZTPDA/ServerCommand/getProductionOrderByShuiXiMai';

type ProductionOrderLookupResponse = {
  ErrCode?: number;
  Message?: string;
  JsonData?: ProductionOrderLookupData;
} & ProductionOrderLookupData;

type ProductionOrderLookupData = {
  成品零件编号?: unknown;
  成品产品名称?: unknown;
  生产订单号?: unknown;
  生产订单编号?: unknown;
  生产订单?: unknown;
  订单号?: unknown;
  工单号?: unknown;
  生产订单数量?: unknown;
  订单数量?: unknown;
  生产数量?: unknown;
  数量?: unknown;
};

@Injectable()
export class ProductionOrderScanLookupService implements ScanLookupGateway {
  constructor(private readonly config: ConfigService) {}

  async lookup(barcode: string): Promise<ScanLookupResult> {
    const trimmedBarcode = barcode.trim();

    if (!trimmedBarcode) {
      throw new BadRequestException({
        code: 'BARCODE_REQUIRED',
        message: '请输入条码'
      });
    }

    const url = this.config.get<string>('SCAN_LOOKUP_URL', defaultLookupUrl);
    const response = await this.fetchProductionOrder(url, trimmedBarcode);

    if (response.ErrCode !== 200) {
      throw new NotFoundException({
        code: 'SCAN_LOOKUP_NOT_FOUND',
        message: response.Message || '未找到零件信息，请修改后重试或重新扫描'
      });
    }

    const lookupData = {
      ...response,
      ...(response.JsonData ?? {})
    };
    const partNumber = this.readString(lookupData, '成品零件编号');
    const productName = this.readString(lookupData, '成品产品名称');
    const productionOrderNo = this.readFirstString(lookupData, [
      '生产订单号',
      '生产订单编号',
      '生产订单',
      '订单号',
      '工单号'
    ]);
    const orderQuantity = this.readFirstNumber(lookupData, [
      '生产订单数量',
      '订单数量',
      '生产数量',
      '数量'
    ]);

    if (!partNumber || !productName) {
      throw new BadGatewayException({
        code: 'SCAN_LOOKUP_INVALID_RESPONSE',
        message: '扫码接口返回数据缺少零件号或产品名称'
      });
    }

    return {
      barcode: trimmedBarcode,
      partNumber,
      vehicleModel: productName,
      ...(productionOrderNo ? { productionOrderNo } : {}),
      ...(orderQuantity ? { orderQuantity } : {}),
      rawData: lookupData,
      source: 'PRODUCTION_ORDER_LOOKUP'
    };
  }

  private async fetchProductionOrder(
    url: string,
    code: string
  ): Promise<ProductionOrderLookupResponse> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Code: code })
      });
    } catch {
      throw new BadGatewayException({
        code: 'SCAN_LOOKUP_UNAVAILABLE',
        message: '扫码接口暂时无法访问，请稍后重试'
      });
    }

    if (!response.ok) {
      throw new BadGatewayException({
        code: 'SCAN_LOOKUP_HTTP_ERROR',
        message: '扫码接口返回异常状态，请稍后重试'
      });
    }

    try {
      return (await response.json()) as ProductionOrderLookupResponse;
    } catch {
      throw new BadGatewayException({
        code: 'SCAN_LOOKUP_INVALID_RESPONSE',
        message: '扫码接口返回数据格式异常'
      });
    }
  }

  private readString(
    data: ProductionOrderLookupData | undefined,
    key: keyof ProductionOrderLookupData
  ): string | null {
    const value = data?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readFirstString(
    data: ProductionOrderLookupData | undefined,
    keys: Array<keyof ProductionOrderLookupData>
  ): string | null {
    for (const key of keys) {
      const value = this.readString(data, key);
      if (value) {
        return value;
      }
    }

    return null;
  }

  private readFirstNumber(
    data: ProductionOrderLookupData | undefined,
    keys: Array<keyof ProductionOrderLookupData>
  ): number | null {
    for (const key of keys) {
      const value = data?.[key];
      const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
      if (Number.isInteger(numberValue) && numberValue > 0) {
        return numberValue;
      }
    }

    return null;
  }
}
