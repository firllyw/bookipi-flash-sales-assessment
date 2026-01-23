import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService, RedisService, PurchaseResult, ORDERS_QUEUE } from '@app/shared';
import {
  CreateFlashSaleDto,
  PurchaseDto,
  FlashSaleResponseDto,
  OrderStatusResponseDto,
} from './dto';

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @InjectQueue(ORDERS_QUEUE) private readonly ordersQueue: Queue,
  ) {}

  async create(dto: CreateFlashSaleDto): Promise<FlashSaleResponseDto> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Create in database
    const flashSale = await this.prisma.flashSale.create({
      data: {
        productId: dto.productId,
        stock: dto.stock,
        startTime,
        endTime,
      },
    });

    // Initialize in Redis
    await this.redisService.initFlashSale(
      flashSale.id,
      dto.stock,
      startTime,
      endTime,
    );

    return this.toResponseDto(flashSale);
  }

  async findAll(): Promise<FlashSaleResponseDto[]> {
    const flashSales = await this.prisma.flashSale.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const responses: FlashSaleResponseDto[] = [];

    for (const flashSale of flashSales) {
      const currentStock = await this.redisService.getStock(flashSale.id);
      const now = new Date();
      const isActive = now >= flashSale.startTime && now <= flashSale.endTime;

      responses.push({
        ...this.toResponseDto(flashSale),
        currentStock,
        isActive,
      });
    }

    return responses;
  }

  async findOne(id: string): Promise<FlashSaleResponseDto> {
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id },
    });

    if (!flashSale) {
      throw new NotFoundException(`Flash sale with ID ${id} not found`);
    }

    const currentStock = await this.redisService.getStock(id);
    const now = new Date();
    const isActive = now >= flashSale.startTime && now <= flashSale.endTime;

    return {
      ...this.toResponseDto(flashSale),
      currentStock,
      isActive,
    };
  }

  async purchase(
    flashSaleId: string,
    dto: PurchaseDto,
  ): Promise<{ message: string }> {
    // 1. Get flash sale from DB to validate existence
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
    });

    if (!flashSale) {
      throw new NotFoundException(`Flash sale with ID ${flashSaleId} not found`);
    }

    // 2. Validate time window
    const now = new Date();
    if (now < flashSale.startTime) {
      throw new BadRequestException('Flash sale has not started yet');
    }
    if (now > flashSale.endTime) {
      throw new BadRequestException('Flash sale has ended');
    }

    // 3. Execute atomic Lua script
    const result = await this.redisService.attemptPurchase(
      flashSaleId,
      dto.userId,
      1, // quantity is always 1
    );

    // 4. Handle result
    switch (result) {
      case PurchaseResult.SUCCESS:
        // Add job to queue for async DB write
        await this.ordersQueue.add('create-order', {
          userId: dto.userId,
          flashSaleId: flashSaleId,
        });
        return { message: 'Purchase accepted. Order is being processed.' };

      case PurchaseResult.SOLD_OUT:
        throw new ForbiddenException('Sold out');

      case PurchaseResult.INVALID_QUANTITY:
        throw new BadRequestException('Invalid quantity. Must be exactly 1.');

      case PurchaseResult.ALREADY_PURCHASED:
        throw new ConflictException('You have already purchased this item');

      default:
        throw new BadRequestException('Unknown error occurred');
    }
  }

  async getOrders(flashSaleId: string): Promise<{
    id: string;
    userId: string;
    flashSaleId: string;
    createdAt: Date;
  }[]> {
    // Verify flash sale exists
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
    });

    if (!flashSale) {
      throw new NotFoundException(`Flash sale with ID ${flashSaleId} not found`);
    }

    // Get all orders for this flash sale
    const orders = await this.prisma.order.findMany({
      where: { flashSaleId },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((order) => ({
      id: order.id,
      userId: order.userId,
      flashSaleId: order.flashSaleId,
      createdAt: order.createdAt,
    }));
  }

  async checkOrderStatus(
    flashSaleId: string,
    userId: string,
  ): Promise<OrderStatusResponseDto> {
    // Check in database for final confirmation
    const order = await this.prisma.order.findUnique({
      where: {
        userId_flashSaleId: {
          userId,
          flashSaleId,
        },
      },
    });

    if (order) {
      return {
        secured: true,
        order: {
          id: order.id,
          userId: order.userId,
          flashSaleId: order.flashSaleId,
          createdAt: order.createdAt,
        },
      };
    }

    // Check if user is in Redis winners set (order might be processing)
    const isWinner = await this.redisService.isWinner(flashSaleId, userId);

    if (isWinner) {
      return {
        secured: true,
        order: undefined, // Order is still being processed
      };
    }

    return {
      secured: false,
    };
  }

  private toResponseDto(flashSale: {
    id: string;
    productId: string;
    stock: number;
    startTime: Date;
    endTime: Date;
    createdAt: Date;
  }): FlashSaleResponseDto {
    return {
      id: flashSale.id,
      productId: flashSale.productId,
      stock: flashSale.stock,
      startTime: flashSale.startTime,
      endTime: flashSale.endTime,
      createdAt: flashSale.createdAt,
    };
  }
}
