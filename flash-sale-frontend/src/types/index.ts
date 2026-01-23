// Flash Sale types
export interface FlashSale {
  id: string;
  productId: string;
  stock: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface FlashSaleWithStock extends FlashSale {
  currentStock: number;
  totalSold: number;
}

export interface Order {
  id: string;
  userId: string;
  flashSaleId: string;
  createdAt: string;
}

// API Response types
export interface FlashSaleResponse {
  id: string;
  productId: string;
  stock: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  currentStock: number;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  flashSaleId: string;
  userId: string;
  result: PurchaseResult;
}

export type PurchaseResult =
  | 'SUCCESS'
  | 'SOLD_OUT'
  | 'ALREADY_PURCHASED'
  | 'NOT_STARTED'
  | 'ENDED'
  | 'NOT_FOUND';

export interface OrderStatusResponse {
  secured: boolean;
  order?: Order;
}

// Form types
export interface CreateFlashSaleDto {
  productId: string;
  stock: number;
  startTime: string;
  endTime: string;
}

// UI State types
export type SaleStatus = 'active' | 'ended' | 'not_started' | 'loading';

export interface PurchaseFeedback {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
