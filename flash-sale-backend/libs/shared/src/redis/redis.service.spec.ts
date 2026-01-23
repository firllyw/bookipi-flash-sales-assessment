import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { PurchaseResult, FLASH_SALE_PURCHASE_SCRIPT } from './lua-scripts';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: {
    script: jest.Mock;
    multi: jest.Mock;
    set: jest.Mock;
    hset: jest.Mock;
    exec: jest.Mock;
    evalsha: jest.Mock;
    hgetall: jest.Mock;
    get: jest.Mock;
    sismember: jest.Mock;
    del: jest.Mock;
  };

  const flashSaleId = 'test-flash-sale-123';
  const userId = 'user@test.com';
  const stockKey = `flashsale:${flashSaleId}:stock`;
  const winnersKey = `flashsale:${flashSaleId}:winners`;
  const metaKey = `flashsale:${flashSaleId}:meta`;
  const mockScriptSha = 'mock-sha-123456789';

  beforeEach(async () => {
    const multiMock = {
      set: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedis = {
      script: jest.fn().mockResolvedValue(mockScriptSha),
      multi: jest.fn().mockReturnValue(multiMock),
      set: multiMock.set,
      hset: multiMock.hset,
      exec: multiMock.exec,
      evalsha: jest.fn(),
      hgetall: jest.fn(),
      get: jest.fn(),
      sismember: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe('onModuleInit', () => {
    it('should load Lua script and store SHA', async () => {
      await service.onModuleInit();

      expect(mockRedis.script).toHaveBeenCalledWith(
        'LOAD',
        FLASH_SALE_PURCHASE_SCRIPT,
      );
    });

    it('should handle script loading failure', async () => {
      mockRedis.script.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.onModuleInit()).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });

  describe('initFlashSale', () => {
    const stock = 100;
    const startTime = new Date('2025-01-01T10:00:00Z');
    const endTime = new Date('2025-01-01T12:00:00Z');

    it('should initialize flash sale data in Redis', async () => {
      await service.initFlashSale(flashSaleId, stock, startTime, endTime);

      expect(mockRedis.multi).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(stockKey, stock);
      expect(mockRedis.hset).toHaveBeenCalledWith(metaKey, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      expect(mockRedis.exec).toHaveBeenCalled();
    });

    it('should handle stock of 0', async () => {
      await service.initFlashSale(flashSaleId, 0, startTime, endTime);

      expect(mockRedis.set).toHaveBeenCalledWith(stockKey, 0);
    });

    it('should handle large stock values', async () => {
      const largeStock = 1000000;
      await service.initFlashSale(flashSaleId, largeStock, startTime, endTime);

      expect(mockRedis.set).toHaveBeenCalledWith(stockKey, largeStock);
    });

    it('should use atomic multi/exec for data consistency', async () => {
      await service.initFlashSale(flashSaleId, stock, startTime, endTime);

      // Verify multi was called before set/hset
      expect(mockRedis.multi).toHaveBeenCalled();
      // Verify exec was called after all operations
      expect(mockRedis.exec).toHaveBeenCalled();
    });
  });

  describe('attemptPurchase', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return SUCCESS when purchase succeeds', async () => {
      mockRedis.evalsha.mockResolvedValue(PurchaseResult.SUCCESS);

      const result = await service.attemptPurchase(flashSaleId, userId, 1);

      expect(result).toBe(PurchaseResult.SUCCESS);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        mockScriptSha,
        2,
        stockKey,
        winnersKey,
        userId,
        '1',
      );
    });

    it('should return SOLD_OUT when stock is depleted', async () => {
      mockRedis.evalsha.mockResolvedValue(PurchaseResult.SOLD_OUT);

      const result = await service.attemptPurchase(flashSaleId, userId, 1);

      expect(result).toBe(PurchaseResult.SOLD_OUT);
    });

    it('should return ALREADY_PURCHASED when user already bought', async () => {
      mockRedis.evalsha.mockResolvedValue(PurchaseResult.ALREADY_PURCHASED);

      const result = await service.attemptPurchase(flashSaleId, userId, 1);

      expect(result).toBe(PurchaseResult.ALREADY_PURCHASED);
    });

    it('should return INVALID_QUANTITY for quantity != 1', async () => {
      mockRedis.evalsha.mockResolvedValue(PurchaseResult.INVALID_QUANTITY);

      const result = await service.attemptPurchase(flashSaleId, userId, 2);

      expect(result).toBe(PurchaseResult.INVALID_QUANTITY);
    });

    it('should default quantity to 1', async () => {
      mockRedis.evalsha.mockResolvedValue(PurchaseResult.SUCCESS);

      await service.attemptPurchase(flashSaleId, userId);

      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        mockScriptSha,
        2,
        stockKey,
        winnersKey,
        userId,
        '1',
      );
    });

    it('should handle concurrent purchase attempts', async () => {
      // Simulate multiple concurrent purchases
      mockRedis.evalsha
        .mockResolvedValueOnce(PurchaseResult.SUCCESS)
        .mockResolvedValueOnce(PurchaseResult.SUCCESS)
        .mockResolvedValueOnce(PurchaseResult.SOLD_OUT);

      const results = await Promise.all([
        service.attemptPurchase(flashSaleId, 'user1@test.com', 1),
        service.attemptPurchase(flashSaleId, 'user2@test.com', 1),
        service.attemptPurchase(flashSaleId, 'user3@test.com', 1),
      ]);

      expect(results).toContain(PurchaseResult.SUCCESS);
      expect(results).toContain(PurchaseResult.SOLD_OUT);
    });

    it('should handle Redis evalsha failure', async () => {
      mockRedis.evalsha.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.attemptPurchase(flashSaleId, userId, 1),
      ).rejects.toThrow('Redis error');
    });
  });

  describe('getFlashSaleMeta', () => {
    it('should return metadata when exists', async () => {
      mockRedis.hgetall.mockResolvedValue({
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: '2025-01-01T12:00:00.000Z',
      });

      const result = await service.getFlashSaleMeta(flashSaleId);

      expect(result).toEqual({
        startTime: '2025-01-01T10:00:00.000Z',
        endTime: '2025-01-01T12:00:00.000Z',
      });
      expect(mockRedis.hgetall).toHaveBeenCalledWith(metaKey);
    });

    it('should return null when metadata does not exist', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const result = await service.getFlashSaleMeta(flashSaleId);

      expect(result).toBeNull();
    });

    it('should return null when startTime is missing', async () => {
      mockRedis.hgetall.mockResolvedValue({
        endTime: '2025-01-01T12:00:00.000Z',
      });

      const result = await service.getFlashSaleMeta(flashSaleId);

      expect(result).toBeNull();
    });

    it('should return null when endTime is missing', async () => {
      mockRedis.hgetall.mockResolvedValue({
        startTime: '2025-01-01T10:00:00.000Z',
      });

      const result = await service.getFlashSaleMeta(flashSaleId);

      expect(result).toBeNull();
    });

    it('should return null when hgetall returns null', async () => {
      mockRedis.hgetall.mockResolvedValue(null);

      const result = await service.getFlashSaleMeta(flashSaleId);

      expect(result).toBeNull();
    });
  });

  describe('getStock', () => {
    it('should return current stock count', async () => {
      mockRedis.get.mockResolvedValue('50');

      const result = await service.getStock(flashSaleId);

      expect(result).toBe(50);
      expect(mockRedis.get).toHaveBeenCalledWith(stockKey);
    });

    it('should return 0 when stock key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getStock(flashSaleId);

      expect(result).toBe(0);
    });

    it('should return 0 when stock is empty string', async () => {
      mockRedis.get.mockResolvedValue('');

      const result = await service.getStock(flashSaleId);

      expect(result).toBe(0);
    });

    it('should handle large stock values', async () => {
      mockRedis.get.mockResolvedValue('1000000');

      const result = await service.getStock(flashSaleId);

      expect(result).toBe(1000000);
    });

    it('should return 0 for depleted stock', async () => {
      mockRedis.get.mockResolvedValue('0');

      const result = await service.getStock(flashSaleId);

      expect(result).toBe(0);
    });
  });

  describe('isWinner', () => {
    it('should return true when user is in winners set', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await service.isWinner(flashSaleId, userId);

      expect(result).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith(winnersKey, userId);
    });

    it('should return false when user is not in winners set', async () => {
      mockRedis.sismember.mockResolvedValue(0);

      const result = await service.isWinner(flashSaleId, userId);

      expect(result).toBe(false);
    });

    it('should handle special characters in userId', async () => {
      const specialUserId = 'user+special@test.com';
      mockRedis.sismember.mockResolvedValue(1);

      await service.isWinner(flashSaleId, specialUserId);

      expect(mockRedis.sismember).toHaveBeenCalledWith(winnersKey, specialUserId);
    });
  });

  describe('deleteFlashSale', () => {
    it('should delete all flash sale keys from Redis', async () => {
      mockRedis.del.mockResolvedValue(3);

      await service.deleteFlashSale(flashSaleId);

      expect(mockRedis.del).toHaveBeenCalledWith(stockKey, winnersKey, metaKey);
    });

    it('should not throw when keys do not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(service.deleteFlashSale(flashSaleId)).resolves.not.toThrow();
    });

    it('should delete partial keys without error', async () => {
      mockRedis.del.mockResolvedValue(2); // Only 2 of 3 keys existed

      await expect(service.deleteFlashSale(flashSaleId)).resolves.not.toThrow();
    });
  });

  describe('key generation', () => {
    it('should generate correct stock key format', async () => {
      mockRedis.get.mockResolvedValue('10');
      
      await service.getStock('abc-123');
      
      expect(mockRedis.get).toHaveBeenCalledWith('flashsale:abc-123:stock');
    });

    it('should handle UUIDs in key generation', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockRedis.get.mockResolvedValue('10');
      
      await service.getStock(uuid);
      
      expect(mockRedis.get).toHaveBeenCalledWith(`flashsale:${uuid}:stock`);
    });
  });
});
