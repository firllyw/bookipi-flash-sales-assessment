import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { PrismaService, RedisService, PurchaseResult, ORDERS_QUEUE } from '@app/shared';

describe('FlashSaleService', () => {
  let service: FlashSaleService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let ordersQueue: { add: jest.Mock };

  const mockFlashSale = {
    id: 'test-uuid-123',
    productId: 'iPhone 15 Pro',
    stock: 10,
    startTime: new Date('2025-01-01T10:00:00Z'),
    endTime: new Date('2025-01-01T12:00:00Z'),
    createdAt: new Date('2024-12-01T00:00:00Z'),
  };

  const mockOrder = {
    id: 'order-uuid-123',
    userId: 'user@test.com',
    flashSaleId: 'test-uuid-123',
    createdAt: new Date('2025-01-01T10:30:00Z'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      flashSale: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const mockRedisService = {
      initFlashSale: jest.fn(),
      getStock: jest.fn(),
      attemptPurchase: jest.fn(),
      isWinner: jest.fn(),
    };

    const mockOrdersQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: getQueueToken(ORDERS_QUEUE), useValue: mockOrdersQueue },
      ],
    }).compile();

    service = module.get<FlashSaleService>(FlashSaleService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    ordersQueue = module.get(getQueueToken(ORDERS_QUEUE));
  });

  describe('create', () => {
    const createDto = {
      productId: 'iPhone 15 Pro',
      stock: 10,
      startTime: '2025-01-01T10:00:00Z',
      endTime: '2025-01-01T12:00:00Z',
    };

    it('should create a flash sale successfully', async () => {
      prismaService.flashSale.create.mockResolvedValue(mockFlashSale);
      redisService.initFlashSale.mockResolvedValue(undefined);

      const result = await service.create(createDto);

      expect(prismaService.flashSale.create).toHaveBeenCalledWith({
        data: {
          productId: createDto.productId,
          stock: createDto.stock,
          startTime: new Date(createDto.startTime),
          endTime: new Date(createDto.endTime),
        },
      });
      expect(redisService.initFlashSale).toHaveBeenCalledWith(
        mockFlashSale.id,
        createDto.stock,
        new Date(createDto.startTime),
        new Date(createDto.endTime),
      );
      expect(result.id).toBe(mockFlashSale.id);
      expect(result.productId).toBe(mockFlashSale.productId);
    });

    it('should throw BadRequestException when start time is after end time', async () => {
      const invalidDto = {
        ...createDto,
        startTime: '2025-01-01T14:00:00Z', // After end time
        endTime: '2025-01-01T12:00:00Z',
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'Start time must be before end time',
      );
    });

    it('should throw BadRequestException when start time equals end time', async () => {
      const invalidDto = {
        ...createDto,
        startTime: '2025-01-01T12:00:00Z',
        endTime: '2025-01-01T12:00:00Z',
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle edge case with stock of 1', async () => {
      const singleStockDto = { ...createDto, stock: 1 };
      const singleStockSale = { ...mockFlashSale, stock: 1 };
      
      prismaService.flashSale.create.mockResolvedValue(singleStockSale);
      redisService.initFlashSale.mockResolvedValue(undefined);

      const result = await service.create(singleStockDto);
      expect(result.stock).toBe(1);
    });

    it('should handle large stock values', async () => {
      const largeStockDto = { ...createDto, stock: 1000000 };
      const largeStockSale = { ...mockFlashSale, stock: 1000000 };
      
      prismaService.flashSale.create.mockResolvedValue(largeStockSale);
      redisService.initFlashSale.mockResolvedValue(undefined);

      const result = await service.create(largeStockDto);
      expect(result.stock).toBe(1000000);
    });
  });

  describe('findAll', () => {
    it('should return all flash sales with current stock', async () => {
      const flashSales = [mockFlashSale, { ...mockFlashSale, id: 'test-uuid-456' }];
      prismaService.flashSale.findMany.mockResolvedValue(flashSales);
      redisService.getStock.mockResolvedValue(5);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].currentStock).toBe(5);
      expect(prismaService.flashSale.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no flash sales exist', async () => {
      prismaService.flashSale.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should correctly determine isActive status for active sale', async () => {
      const now = new Date();
      const activeSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() - 60000), // 1 minute ago
        endTime: new Date(now.getTime() + 60000), // 1 minute from now
      };
      prismaService.flashSale.findMany.mockResolvedValue([activeSale]);
      redisService.getStock.mockResolvedValue(5);

      const result = await service.findAll();

      expect(result[0].isActive).toBe(true);
    });

    it('should correctly determine isActive status for ended sale', async () => {
      const now = new Date();
      const endedSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() - 120000), // 2 minutes ago
        endTime: new Date(now.getTime() - 60000), // 1 minute ago
      };
      prismaService.flashSale.findMany.mockResolvedValue([endedSale]);
      redisService.getStock.mockResolvedValue(5);

      const result = await service.findAll();

      expect(result[0].isActive).toBe(false);
    });

    it('should correctly determine isActive status for future sale', async () => {
      const now = new Date();
      const futureSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() + 60000), // 1 minute from now
        endTime: new Date(now.getTime() + 120000), // 2 minutes from now
      };
      prismaService.flashSale.findMany.mockResolvedValue([futureSale]);
      redisService.getStock.mockResolvedValue(5);

      const result = await service.findAll();

      expect(result[0].isActive).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should return a flash sale by ID', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(mockFlashSale);
      redisService.getStock.mockResolvedValue(7);

      const result = await service.findOne(mockFlashSale.id);

      expect(result.id).toBe(mockFlashSale.id);
      expect(result.currentStock).toBe(7);
    });

    it('should throw NotFoundException when flash sale does not exist', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Flash sale with ID non-existent-id not found',
      );
    });

    it('should return correct stock when sale is sold out', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(mockFlashSale);
      redisService.getStock.mockResolvedValue(0);

      const result = await service.findOne(mockFlashSale.id);

      expect(result.currentStock).toBe(0);
    });
  });

  describe('purchase', () => {
    const purchaseDto = { userId: 'user@test.com' };
    
    beforeEach(() => {
      // Set up an active flash sale by default
      const now = new Date();
      const activeSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() - 60000),
        endTime: new Date(now.getTime() + 60000),
      };
      prismaService.flashSale.findUnique.mockResolvedValue(activeSale);
    });

    it('should successfully process a purchase', async () => {
      redisService.attemptPurchase.mockResolvedValue(PurchaseResult.SUCCESS);
      ordersQueue.add.mockResolvedValue({ id: 'job-123' });

      const result = await service.purchase(mockFlashSale.id, purchaseDto);

      expect(result.message).toBe('Purchase accepted. Order is being processed.');
      expect(redisService.attemptPurchase).toHaveBeenCalledWith(
        mockFlashSale.id,
        purchaseDto.userId,
        1,
      );
      expect(ordersQueue.add).toHaveBeenCalledWith('create-order', {
        userId: purchaseDto.userId,
        flashSaleId: mockFlashSale.id,
      });
    });

    it('should throw NotFoundException when flash sale does not exist', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(null);

      await expect(
        service.purchase('non-existent-id', purchaseDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when sale has not started', async () => {
      const now = new Date();
      const futureSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() + 60000),
        endTime: new Date(now.getTime() + 120000),
      };
      prismaService.flashSale.findUnique.mockResolvedValue(futureSale);

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('Flash sale has not started yet');
    });

    it('should throw BadRequestException when sale has ended', async () => {
      const now = new Date();
      const endedSale = {
        ...mockFlashSale,
        startTime: new Date(now.getTime() - 120000),
        endTime: new Date(now.getTime() - 60000),
      };
      prismaService.flashSale.findUnique.mockResolvedValue(endedSale);

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('Flash sale has ended');
    });

    it('should throw ForbiddenException when sold out', async () => {
      redisService.attemptPurchase.mockResolvedValue(PurchaseResult.SOLD_OUT);

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('Sold out');
    });

    it('should throw ConflictException when user already purchased', async () => {
      redisService.attemptPurchase.mockResolvedValue(
        PurchaseResult.ALREADY_PURCHASED,
      );

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('You have already purchased this item');
    });

    it('should throw BadRequestException for invalid quantity', async () => {
      redisService.attemptPurchase.mockResolvedValue(
        PurchaseResult.INVALID_QUANTITY,
      );

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('Invalid quantity. Must be exactly 1.');
    });

    it('should throw BadRequestException for unknown result', async () => {
      redisService.attemptPurchase.mockResolvedValue(999 as PurchaseResult);

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow('Unknown error occurred');
    });

    it('should handle purchase at exact start time boundary', async () => {
      const now = new Date();
      const boundaryStartSale = {
        ...mockFlashSale,
        startTime: now,
        endTime: new Date(now.getTime() + 60000),
      };
      prismaService.flashSale.findUnique.mockResolvedValue(boundaryStartSale);
      redisService.attemptPurchase.mockResolvedValue(PurchaseResult.SUCCESS);
      ordersQueue.add.mockResolvedValue({ id: 'job-123' });

      const result = await service.purchase(mockFlashSale.id, purchaseDto);
      expect(result.message).toBe('Purchase accepted. Order is being processed.');
    });

    it('should not add job to queue when purchase fails', async () => {
      redisService.attemptPurchase.mockResolvedValue(PurchaseResult.SOLD_OUT);

      await expect(
        service.purchase(mockFlashSale.id, purchaseDto),
      ).rejects.toThrow();
      
      expect(ordersQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getOrders', () => {
    it('should return all orders for a flash sale', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(mockFlashSale);
      prismaService.order.findMany.mockResolvedValue([mockOrder]);

      const result = await service.getOrders(mockFlashSale.id);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockOrder.userId);
      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { flashSaleId: mockFlashSale.id },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw NotFoundException when flash sale does not exist', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(null);

      await expect(service.getOrders('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array when no orders exist', async () => {
      prismaService.flashSale.findUnique.mockResolvedValue(mockFlashSale);
      prismaService.order.findMany.mockResolvedValue([]);

      const result = await service.getOrders(mockFlashSale.id);

      expect(result).toEqual([]);
    });

    it('should return orders sorted by createdAt ascending', async () => {
      const orders = [
        { ...mockOrder, createdAt: new Date('2025-01-01T10:30:00Z') },
        { ...mockOrder, id: 'order-2', createdAt: new Date('2025-01-01T10:31:00Z') },
        { ...mockOrder, id: 'order-3', createdAt: new Date('2025-01-01T10:29:00Z') },
      ];
      prismaService.flashSale.findUnique.mockResolvedValue(mockFlashSale);
      prismaService.order.findMany.mockResolvedValue(orders);

      await service.getOrders(mockFlashSale.id);

      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { flashSaleId: mockFlashSale.id },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('checkOrderStatus', () => {
    it('should return secured true with order when order exists in DB', async () => {
      prismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.checkOrderStatus(
        mockFlashSale.id,
        'user@test.com',
      );

      expect(result.secured).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order?.userId).toBe('user@test.com');
    });

    it('should return secured true without order when user is in Redis winners', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);
      redisService.isWinner.mockResolvedValue(true);

      const result = await service.checkOrderStatus(
        mockFlashSale.id,
        'user@test.com',
      );

      expect(result.secured).toBe(true);
      expect(result.order).toBeUndefined();
    });

    it('should return secured false when order does not exist and not in winners', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);
      redisService.isWinner.mockResolvedValue(false);

      const result = await service.checkOrderStatus(
        mockFlashSale.id,
        'user@test.com',
      );

      expect(result.secured).toBe(false);
    });

    it('should not check Redis if order exists in DB', async () => {
      prismaService.order.findUnique.mockResolvedValue(mockOrder);

      await service.checkOrderStatus(mockFlashSale.id, 'user@test.com');

      expect(redisService.isWinner).not.toHaveBeenCalled();
    });

    it('should check Redis with correct parameters', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);
      redisService.isWinner.mockResolvedValue(false);

      await service.checkOrderStatus(mockFlashSale.id, 'user@test.com');

      expect(redisService.isWinner).toHaveBeenCalledWith(
        mockFlashSale.id,
        'user@test.com',
      );
    });
  });
});
