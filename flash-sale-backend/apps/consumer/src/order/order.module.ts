import { Module } from '@nestjs/common';
import { OrderProcessor } from './order.processor';
import { QueueModule } from '@app/shared';

@Module({
  imports: [QueueModule],
  providers: [OrderProcessor],
})
export class OrderModule {}
