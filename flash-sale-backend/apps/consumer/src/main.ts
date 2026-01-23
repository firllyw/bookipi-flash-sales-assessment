import { NestFactory } from '@nestjs/core';
import { ConsumerModule } from './consumer.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Consumer');
  
  const app = await NestFactory.createApplicationContext(ConsumerModule);
  
  logger.log('Consumer worker started and listening for jobs...');
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}
bootstrap();
