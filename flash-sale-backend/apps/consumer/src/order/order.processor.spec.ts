import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { OrderProcessor } from './order.processor';
import { PrismaService } from '@app/shared';
import { Prisma } from '@prisma/client';

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let prismaService: jest.Mocked<PrismaService>;

  const mockOrder = {
    id: 'order-uuid-123',
    userId: 'user@test.com',
    flashSaleId: 'flash-sale-uuid-123',
    createdAt: new Date('2025-01-01T10:30:00Z'),
  };

  const createMockJob = (data: { userId: string; flashSaleId: string }) => ({
    id: 'job-123',
    data,
    log: jest.fn(),
  }) as unknown as Job<{ userId: string; flashSaleId: string }>;

  beforeEach(async () => {
    const mockPrismaService = {
      order: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    processor = module.get<OrderProcessor>(OrderProcessor);
    prismaService = module.get(PrismaService);
  });

  describe('process', () => {
    it('should create an order successfully', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });
      prismaService.order.create.mockResolvedValue(mockOrder);

      await processor.process(job);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId: 'user@test.com',
          flashSaleId: 'flash-sale-uuid-123',
        },
      });
    });

    it('should handle duplicate order (idempotency) gracefully', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      // Simulate unique constraint violation (P2002)
      const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      prismaService.order.create.mockRejectedValue(uniqueConstraintError);

      // Should not throw - job completes successfully
      await expect(processor.process(job)).resolves.not.toThrow();
    });

    it('should re-throw non-unique-constraint errors for retry', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      // Simulate a different Prisma error (e.g., connection error)
      const connectionError = new Prisma.PrismaClientKnownRequestError(
        'Connection refused',
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      prismaService.order.create.mockRejectedValue(connectionError);

      await expect(processor.process(job)).rejects.toThrow('Connection refused');
    });

    it('should re-throw unknown errors for retry', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      const unknownError = new Error('Unknown database error');
      prismaService.order.create.mockRejectedValue(unknownError);

      await expect(processor.process(job)).rejects.toThrow('Unknown database error');
    });

    it('should handle email with special characters', async () => {
      const job = createMockJob({
        userId: 'user+tag@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });
      prismaService.order.create.mockResolvedValue({
        ...mockOrder,
        userId: 'user+tag@test.com',
      });

      await processor.process(job);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId: 'user+tag@test.com',
          flashSaleId: 'flash-sale-uuid-123',
        },
      });
    });

    it('should handle concurrent job processing', async () => {
      const jobs = [
        createMockJob({ userId: 'user1@test.com', flashSaleId: 'flash-sale-1' }),
        createMockJob({ userId: 'user2@test.com', flashSaleId: 'flash-sale-1' }),
        createMockJob({ userId: 'user3@test.com', flashSaleId: 'flash-sale-1' }),
      ];

      prismaService.order.create.mockResolvedValue(mockOrder);

      await Promise.all(jobs.map((job) => processor.process(job)));

      expect(prismaService.order.create).toHaveBeenCalledTimes(3);
    });

    it('should handle retry scenario where first attempt fails but second succeeds', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      // First call fails with connection error
      prismaService.order.create
        .mockRejectedValueOnce(new Error('Temporary connection error'))
        .mockResolvedValueOnce(mockOrder);

      // First attempt throws
      await expect(processor.process(job)).rejects.toThrow(
        'Temporary connection error',
      );

      // Second attempt (retry) succeeds
      await expect(processor.process(job)).resolves.not.toThrow();
    });

    it('should handle valid UUID flash sale IDs', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: '550e8400-e29b-41d4-a716-446655440000',
      });
      prismaService.order.create.mockResolvedValue({
        ...mockOrder,
        flashSaleId: '550e8400-e29b-41d4-a716-446655440000',
      });

      await processor.process(job);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId: 'user@test.com',
          flashSaleId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });
    });

    it('should not retry on unique constraint violation even with multiple calls', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      prismaService.order.create.mockRejectedValue(uniqueConstraintError);

      // Call multiple times (simulating retries)
      await processor.process(job);
      await processor.process(job);
      await processor.process(job);

      // All should complete without throwing
      expect(prismaService.order.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string userId', async () => {
      const job = createMockJob({
        userId: '',
        flashSaleId: 'flash-sale-uuid-123',
      });
      prismaService.order.create.mockResolvedValue({
        ...mockOrder,
        userId: '',
      });

      await processor.process(job);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId: '',
          flashSaleId: 'flash-sale-uuid-123',
        },
      });
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(200) + '@test.com';
      const job = createMockJob({
        userId: longEmail,
        flashSaleId: 'flash-sale-uuid-123',
      });
      prismaService.order.create.mockResolvedValue({
        ...mockOrder,
        userId: longEmail,
      });

      await processor.process(job);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId: longEmail,
          flashSaleId: 'flash-sale-uuid-123',
        },
      });
    });

    it('should handle foreign key constraint violation', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'non-existent-flash-sale',
      });

      const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: '5.0.0' },
      );
      prismaService.order.create.mockRejectedValue(foreignKeyError);

      // Should re-throw for retry (though in practice this indicates a bug)
      await expect(processor.process(job)).rejects.toThrow(
        'Foreign key constraint failed',
      );
    });

    it('should handle database timeout errors', async () => {
      const job = createMockJob({
        userId: 'user@test.com',
        flashSaleId: 'flash-sale-uuid-123',
      });

      const timeoutError = new Prisma.PrismaClientKnownRequestError(
        'Query timed out',
        { code: 'P2024', clientVersion: '5.0.0' },
      );
      prismaService.order.create.mockRejectedValue(timeoutError);

      await expect(processor.process(job)).rejects.toThrow('Query timed out');
    });
  });
});
