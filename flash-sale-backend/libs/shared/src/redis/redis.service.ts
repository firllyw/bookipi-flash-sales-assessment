import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { FLASH_SALE_PURCHASE_SCRIPT, PurchaseResult } from './lua-scripts';

@Injectable()
export class RedisService implements OnModuleInit {
  private purchaseScriptSha: string;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleInit() {
    // Load the Lua script into Redis and get its SHA
    this.purchaseScriptSha = (await this.redis.script(
      'LOAD',
      FLASH_SALE_PURCHASE_SCRIPT,
    )) as string;
  }

  /**
   * Initialize flash sale data in Redis
   */
  async initFlashSale(
    flashSaleId: string,
    stock: number,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const stockKey = this.getStockKey(flashSaleId);
    const metaKey = this.getMetaKey(flashSaleId);

    await this.redis
      .multi()
      .set(stockKey, stock)
      .hset(metaKey, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
      .exec();
  }

  /**
   * Execute the atomic purchase Lua script
   */
  async attemptPurchase(
    flashSaleId: string,
    userId: string,
    quantity: number = 1,
  ): Promise<PurchaseResult> {
    const stockKey = this.getStockKey(flashSaleId);
    const winnersKey = this.getWinnersKey(flashSaleId);

    const result = await this.redis.evalsha(
      this.purchaseScriptSha,
      2,
      stockKey,
      winnersKey,
      userId,
      quantity.toString(),
    );

    return result as PurchaseResult;
  }

  /**
   * Get flash sale metadata from Redis
   */
  async getFlashSaleMeta(
    flashSaleId: string,
  ): Promise<{ startTime: string; endTime: string } | null> {
    const metaKey = this.getMetaKey(flashSaleId);
    const meta = await this.redis.hgetall(metaKey);

    if (!meta || !meta.startTime || !meta.endTime) {
      return null;
    }

    return {
      startTime: meta.startTime,
      endTime: meta.endTime,
    };
  }

  /**
   * Get current stock count
   */
  async getStock(flashSaleId: string): Promise<number> {
    const stockKey = this.getStockKey(flashSaleId);
    const stock = await this.redis.get(stockKey);
    return stock ? parseInt(stock, 10) : 0;
  }

  /**
   * Check if user is in winners set
   */
  async isWinner(flashSaleId: string, userId: string): Promise<boolean> {
    const winnersKey = this.getWinnersKey(flashSaleId);
    return (await this.redis.sismember(winnersKey, userId)) === 1;
  }

  /**
   * Delete flash sale data from Redis
   */
  async deleteFlashSale(flashSaleId: string): Promise<void> {
    const stockKey = this.getStockKey(flashSaleId);
    const winnersKey = this.getWinnersKey(flashSaleId);
    const metaKey = this.getMetaKey(flashSaleId);

    await this.redis.del(stockKey, winnersKey, metaKey);
  }

  private getStockKey(flashSaleId: string): string {
    return `flashsale:${flashSaleId}:stock`;
  }

  private getWinnersKey(flashSaleId: string): string {
    return `flashsale:${flashSaleId}:winners`;
  }

  private getMetaKey(flashSaleId: string): string {
    return `flashsale:${flashSaleId}:meta`;
  }
}
