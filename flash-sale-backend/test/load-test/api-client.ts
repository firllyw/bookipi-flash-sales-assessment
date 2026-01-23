import { FlashSaleResponse, PurchaseResult } from './types';

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async createFlashSale(
    productId: string,
    stock: number,
    startTime: Date,
    endTime: Date,
  ): Promise<FlashSaleResponse> {
    const response = await fetch(`${this.baseUrl}/flash-sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        stock,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create flash sale: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async purchaseItem(flashSaleId: string, email: string): Promise<PurchaseResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const response = await fetch(`${this.baseUrl}/flash-sales/${flashSaleId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: email,
        }),
      });

      const responseTimeMs = Date.now() - startTime;
      const body = await response.json().catch(() => ({}));

      if (response.status === 202) {
        return {
          email,
          flashSaleId,
          success: true,
          statusCode: response.status,
          reason: 'SUCCESS',
          message: body.message,
          timestamp,
          responseTimeMs,
        };
      }

      // Map HTTP status codes to reasons
      let reason: PurchaseResult['reason'] = 'ERROR';
      if (response.status === 403) {
        reason = 'SOLD_OUT';
      } else if (response.status === 409) {
        reason = 'ALREADY_PURCHASED';
      } else if (response.status === 400) {
        if (body.message?.includes('not started')) {
          reason = 'NOT_STARTED';
        } else if (body.message?.includes('ended')) {
          reason = 'ENDED';
        }
      }

      return {
        email,
        flashSaleId,
        success: false,
        statusCode: response.status,
        reason,
        message: body.message,
        timestamp,
        responseTimeMs,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      return {
        email,
        flashSaleId,
        success: false,
        statusCode: 0,
        reason: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        responseTimeMs,
      };
    }
  }

  async getFlashSale(flashSaleId: string): Promise<FlashSaleResponse> {
    const response = await fetch(`${this.baseUrl}/flash-sales/${flashSaleId}`);

    if (!response.ok) {
      throw new Error(`Failed to get flash sale: ${response.status}`);
    }

    return response.json();
  }

  async checkOrderStatus(
    flashSaleId: string,
    email: string,
  ): Promise<{ secured: boolean; order?: { id: string } }> {
    const response = await fetch(
      `${this.baseUrl}/flash-sales/${flashSaleId}/orders/${encodeURIComponent(email)}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to check order status: ${response.status}`);
    }

    return response.json();
  }
}
