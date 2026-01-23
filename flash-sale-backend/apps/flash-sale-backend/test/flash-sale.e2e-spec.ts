import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService, RedisService } from '@app/shared';

describe('FlashSaleController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let redisService: RedisService;

  // Track created flash sales for cleanup
  const createdFlashSaleIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same validation pipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);
  });

  afterAll(async () => {
    // Clean up created flash sales
    for (const id of createdFlashSaleIds) {
      try {
        await prismaService.order.deleteMany({ where: { flashSaleId: id } });
        await prismaService.flashSale.delete({ where: { id } });
        await redisService.deleteFlashSale(id);
      } catch {
        // Ignore errors during cleanup
      }
    }

    await app.close();
  });

  describe('POST /flash-sales', () => {
    it('should create a new flash sale', async () => {
      const now = new Date();
      const createDto = {
        productId: 'Test Product E2E',
        stock: 10,
        startTime: new Date(now.getTime() + 60000).toISOString(), // 1 minute from now
        endTime: new Date(now.getTime() + 3600000).toISOString(), // 1 hour from now
      };

      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.productId).toBe(createDto.productId);
      expect(response.body.stock).toBe(createDto.stock);

      createdFlashSaleIds.push(response.body.id);
    });

    it('should return 400 for invalid time window (start after end)', async () => {
      const now = new Date();
      const createDto = {
        productId: 'Invalid Product',
        stock: 10,
        startTime: new Date(now.getTime() + 3600000).toISOString(), // 1 hour from now
        endTime: new Date(now.getTime() + 60000).toISOString(), // 1 minute from now (before start)
      };

      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send(createDto)
        .expect(400);

      expect(response.body.message).toContain('Start time must be before end time');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({ productId: 'Test' })
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid stock (negative)', async () => {
      const now = new Date();
      const createDto = {
        productId: 'Test Product',
        stock: -5,
        startTime: new Date(now.getTime() + 60000).toISOString(),
        endTime: new Date(now.getTime() + 3600000).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send(createDto)
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });

    it('should validate productId is a string', async () => {
      const now = new Date();
      const createDto = {
        productId: 12345, // Invalid - should be string
        stock: 10,
        startTime: new Date(now.getTime() + 60000).toISOString(),
        endTime: new Date(now.getTime() + 3600000).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/flash-sales')
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /flash-sales', () => {
    let testFlashSaleId: string;

    beforeAll(async () => {
      // Create a test flash sale
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Get All Test Product',
          stock: 5,
          startTime: new Date(now.getTime() + 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      testFlashSaleId = response.body.id;
      createdFlashSaleIds.push(testFlashSaleId);
    });

    it('should return all flash sales', async () => {
      const response = await request(app.getHttpServer())
        .get('/flash-sales')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Each sale should have currentStock
      const sale = response.body.find((s: any) => s.id === testFlashSaleId);
      expect(sale).toBeDefined();
      expect(sale).toHaveProperty('currentStock');
      expect(sale).toHaveProperty('isActive');
    });
  });

  describe('GET /flash-sales/:id', () => {
    let testFlashSaleId: string;

    beforeAll(async () => {
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Get One Test Product',
          stock: 10,
          startTime: new Date(now.getTime() + 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      testFlashSaleId = response.body.id;
      createdFlashSaleIds.push(testFlashSaleId);
    });

    it('should return a flash sale by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/flash-sales/${testFlashSaleId}`)
        .expect(200);

      expect(response.body.id).toBe(testFlashSaleId);
      expect(response.body).toHaveProperty('currentStock');
      expect(response.body).toHaveProperty('isActive');
    });

    it('should return 404 for non-existent flash sale', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app.getHttpServer())
        .get(`/flash-sales/${fakeId}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/flash-sales/invalid-id')
        .expect(400);
    });
  });

  describe('POST /flash-sales/:id/purchase', () => {
    let activeFlashSaleId: string;

    beforeEach(async () => {
      // Create an active flash sale for each test
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Purchase Test Product',
          stock: 3, // Small stock for testing sold out
          startTime: new Date(now.getTime() - 60000).toISOString(), // Started 1 minute ago
          endTime: new Date(now.getTime() + 3600000).toISOString(), // Ends in 1 hour
        });

      activeFlashSaleId = response.body.id;
      createdFlashSaleIds.push(activeFlashSaleId);
    });

    it('should successfully purchase an item', async () => {
      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'buyer1@test.com' })
        .expect(202);

      expect(response.body.message).toContain('Purchase accepted');
    });

    it('should prevent duplicate purchase by same user', async () => {
      const userId = 'duplicate-buyer@test.com';

      // First purchase should succeed
      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId })
        .expect(202);

      // Second purchase should fail with 409 Conflict
      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId })
        .expect(409);

      expect(response.body.message).toContain('already purchased');
    });

    it('should return 403 when sold out', async () => {
      // Buy all 3 items
      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'buyer-a@test.com' })
        .expect(202);

      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'buyer-b@test.com' })
        .expect(202);

      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'buyer-c@test.com' })
        .expect(202);

      // 4th purchase should fail with sold out
      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'buyer-d@test.com' })
        .expect(403);

      expect(response.body.message).toContain('Sold out');
    });

    it('should return 400 when sale has not started', async () => {
      // Create a future flash sale
      const now = new Date();
      const futureResponse = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Future Product',
          stock: 10,
          startTime: new Date(now.getTime() + 86400000).toISOString(), // Starts tomorrow
          endTime: new Date(now.getTime() + 172800000).toISOString(), // Ends in 2 days
        });

      const futureId = futureResponse.body.id;
      createdFlashSaleIds.push(futureId);

      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${futureId}/purchase`)
        .send({ userId: 'early-buyer@test.com' })
        .expect(400);

      expect(response.body.message).toContain('not started');
    });

    it('should return 400 when sale has ended', async () => {
      // Create an ended flash sale
      const now = new Date();
      const pastResponse = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Past Product',
          stock: 10,
          startTime: new Date(now.getTime() - 172800000).toISOString(), // Started 2 days ago
          endTime: new Date(now.getTime() - 86400000).toISOString(), // Ended yesterday
        });

      const pastId = pastResponse.body.id;
      createdFlashSaleIds.push(pastId);

      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${pastId}/purchase`)
        .send({ userId: 'late-buyer@test.com' })
        .expect(400);

      expect(response.body.message).toContain('ended');
    });

    it('should return 404 for non-existent flash sale', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .post(`/flash-sales/${fakeId}/purchase`)
        .send({ userId: 'test@test.com' })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should validate email format for userId', async () => {
      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({ userId: 'invalid-email' })
        .expect(400);
    });

    it('should return 400 for missing userId', async () => {
      await request(app.getHttpServer())
        .post(`/flash-sales/${activeFlashSaleId}/purchase`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /flash-sales/:id/orders', () => {
    let flashSaleWithOrders: string;

    beforeAll(async () => {
      // Create a flash sale and some orders
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Orders Test Product',
          stock: 10,
          startTime: new Date(now.getTime() - 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      flashSaleWithOrders = response.body.id;
      createdFlashSaleIds.push(flashSaleWithOrders);

      // Create some orders
      await request(app.getHttpServer())
        .post(`/flash-sales/${flashSaleWithOrders}/purchase`)
        .send({ userId: 'order-test-1@test.com' });

      await request(app.getHttpServer())
        .post(`/flash-sales/${flashSaleWithOrders}/purchase`)
        .send({ userId: 'order-test-2@test.com' });

      // Wait a bit for orders to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('should return all orders for a flash sale', async () => {
      const response = await request(app.getHttpServer())
        .get(`/flash-sales/${flashSaleWithOrders}/orders`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // Note: Orders might still be processing, so we check structure
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('userId');
        expect(response.body[0]).toHaveProperty('flashSaleId');
        expect(response.body[0]).toHaveProperty('createdAt');
      }
    });

    it('should return 404 for non-existent flash sale', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/flash-sales/${fakeId}/orders`)
        .expect(404);
    });
  });

  describe('GET /flash-sales/:id/orders/:userId', () => {
    let flashSaleId: string;
    const buyerEmail = 'status-check-buyer@test.com';

    beforeAll(async () => {
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Status Check Product',
          stock: 10,
          startTime: new Date(now.getTime() - 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      flashSaleId = response.body.id;
      createdFlashSaleIds.push(flashSaleId);

      // Make a purchase
      await request(app.getHttpServer())
        .post(`/flash-sales/${flashSaleId}/purchase`)
        .send({ userId: buyerEmail });

      // Wait for order processing
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('should return secured: true for a successful purchase', async () => {
      const response = await request(app.getHttpServer())
        .get(`/flash-sales/${flashSaleId}/orders/${buyerEmail}`)
        .expect(200);

      expect(response.body.secured).toBe(true);
    });

    it('should return secured: false for non-purchaser', async () => {
      const response = await request(app.getHttpServer())
        .get(`/flash-sales/${flashSaleId}/orders/non-buyer@test.com`)
        .expect(200);

      expect(response.body.secured).toBe(false);
    });
  });

  describe('Concurrent Purchase Handling', () => {
    it('should handle concurrent purchases correctly (no overselling)', async () => {
      // Create flash sale with limited stock
      const now = new Date();
      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Concurrent Test Product',
          stock: 5,
          startTime: new Date(now.getTime() - 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      const flashSaleId = response.body.id;
      createdFlashSaleIds.push(flashSaleId);

      // Send 10 concurrent purchase requests (only 5 should succeed)
      const purchasePromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/flash-sales/${flashSaleId}/purchase`)
          .send({ userId: `concurrent-buyer-${i}@test.com` }),
      );

      const results = await Promise.all(purchasePromises);

      // Count successful purchases
      const successCount = results.filter((r) => r.status === 202).length;
      const soldOutCount = results.filter((r) => r.status === 403).length;

      // Exactly 5 should succeed, 5 should be sold out
      expect(successCount).toBe(5);
      expect(soldOutCount).toBe(5);

      // Verify stock is 0
      const saleResponse = await request(app.getHttpServer())
        .get(`/flash-sales/${flashSaleId}`)
        .expect(200);

      expect(saleResponse.body.currentStock).toBe(0);
    });
  });

  describe('Stock Tracking', () => {
    it('should correctly track stock after purchases', async () => {
      const now = new Date();
      const initialStock = 10;

      const response = await request(app.getHttpServer())
        .post('/flash-sales')
        .send({
          productId: 'Stock Tracking Product',
          stock: initialStock,
          startTime: new Date(now.getTime() - 60000).toISOString(),
          endTime: new Date(now.getTime() + 3600000).toISOString(),
        });

      const flashSaleId = response.body.id;
      createdFlashSaleIds.push(flashSaleId);

      // Make 3 purchases
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(`/flash-sales/${flashSaleId}/purchase`)
          .send({ userId: `stock-track-${i}@test.com` })
          .expect(202);
      }

      // Check remaining stock
      const saleResponse = await request(app.getHttpServer())
        .get(`/flash-sales/${flashSaleId}`)
        .expect(200);

      expect(saleResponse.body.currentStock).toBe(initialStock - 3);
    });
  });
});
