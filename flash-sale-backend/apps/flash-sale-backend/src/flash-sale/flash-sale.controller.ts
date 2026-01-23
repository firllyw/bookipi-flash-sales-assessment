import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import {
  CreateFlashSaleDto,
  PurchaseDto,
  FlashSaleResponseDto,
  OrderStatusResponseDto,
} from './dto';

@Controller('flash-sales')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createFlashSaleDto: CreateFlashSaleDto,
  ): Promise<FlashSaleResponseDto> {
    return this.flashSaleService.create(createFlashSaleDto);
  }

  @Get()
  async findAll(): Promise<FlashSaleResponseDto[]> {
    return this.flashSaleService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FlashSaleResponseDto> {
    return this.flashSaleService.findOne(id);
  }

  @Post(':id/purchase')
  @HttpCode(HttpStatus.ACCEPTED)
  async purchase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() purchaseDto: PurchaseDto,
  ): Promise<{ message: string }> {
    return this.flashSaleService.purchase(id, purchaseDto);
  }

  @Get(':id/orders')
  async getOrders(@Param('id', ParseUUIDPipe) id: string) {
    return this.flashSaleService.getOrders(id);
  }

  @Get(':id/orders/:userId')
  async checkOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId') userId: string,
  ): Promise<OrderStatusResponseDto> {
    return this.flashSaleService.checkOrderStatus(id, userId);
  }
}
