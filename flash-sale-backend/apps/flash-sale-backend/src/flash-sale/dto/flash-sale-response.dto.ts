export class FlashSaleResponseDto {
  id: string;
  productId: string;
  stock: number;
  currentStock?: number;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  isActive?: boolean;
}

export class OrderStatusResponseDto {
  secured: boolean;
  order?: {
    id: string;
    userId: string;
    flashSaleId: string;
    createdAt: Date;
  };
}
