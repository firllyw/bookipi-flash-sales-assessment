import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService, ORDERS_QUEUE } from '@app/shared';
import { Prisma } from '@prisma/client';

interface CreateOrderJobData {
  userId: string;
  flashSaleId: string;
}

@Processor(ORDERS_QUEUE)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CreateOrderJobData>): Promise<void> {
    const { userId, flashSaleId } = job.data;
    
    this.logger.log(
      `Processing order job ${job.id}: userId=${userId}, flashSaleId=${flashSaleId}`,
    );

    try {
      // Attempt to create the order
      const order = await this.prisma.order.create({
        data: {
          userId,
          flashSaleId,
        },
      });

      this.logger.log(
        `Order created successfully: ${order.id} for user ${userId}`,
      );
    } catch (error) {
      // Handle unique constraint violation (idempotency)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint violated - order already exists
        // This is expected in retry scenarios, mark job as complete
        this.logger.log(
          `Order already exists for user ${userId} and flash sale ${flashSaleId} - job considered complete`,
        );
        return; // Job completes successfully
      }

      // For all other errors, log and re-throw to trigger retry
      this.logger.error(
        `Failed to create order for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error; // BullMQ will retry based on backoff settings
    }
  }
}
