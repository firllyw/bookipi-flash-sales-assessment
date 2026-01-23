export interface TestConfig {
  apiBaseUrl: string;
  productId: string;
  stock: number;
  concurrentRequests: number;
  saleDurationMinutes: number;
}

export interface FlashSaleResponse {
  id: string;
  productId: string;
  stock: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  currentStock?: number;
  isActive?: boolean;
}

export interface PurchaseResult {
  email: string;
  flashSaleId: string;
  success: boolean;
  statusCode: number;
  reason?: 'SUCCESS' | 'SOLD_OUT' | 'ALREADY_PURCHASED' | 'ERROR' | 'NOT_STARTED' | 'ENDED';
  message?: string;
  timestamp: Date;
  responseTimeMs: number;
}

export interface WinnerRecord {
  email: string;
  flashSaleId: string;
  timestamp: string;
  responseTimeMs: number;
}

export interface LoserRecord {
  email: string;
  flashSaleId: string;
  reason: string;
  timestamp: string;
  responseTimeMs: number;
}

export interface TestSummary {
  totalRequests: number;
  winners: number;
  losersSoldOut: number;
  losersAlreadyPurchased: number;
  losersOther: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
}
