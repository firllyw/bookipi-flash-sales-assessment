import axios from 'axios';
import type {
  FlashSaleResponse,
  OrderStatusResponse,
  CreateFlashSaleDto,
  Order,
  PurchaseResult,
} from '../types';

const API_BASE = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const flashSaleApi = {
  // Get all flash sales
  getFlashSales: async (): Promise<FlashSaleResponse[]> => {
    const response = await api.get<FlashSaleResponse[]>('/flash-sales');
    return response.data;
  },

  // Get a single flash sale by ID
  getFlashSale: async (id: string): Promise<FlashSaleResponse> => {
    const response = await api.get<FlashSaleResponse>(`/flash-sales/${id}`);
    return response.data;
  },

  // Create a new flash sale
  createFlashSale: async (data: CreateFlashSaleDto): Promise<FlashSaleResponse> => {
    const response = await api.post<FlashSaleResponse>('/flash-sales', data);
    return response.data;
  },

  // Attempt to purchase an item
  purchase: async (saleId: string, email: string): Promise<{ result: PurchaseResult; message: string }> => {
    try {
      const response = await api.post<{ message: string }>(
        `/flash-sales/${saleId}/purchase`,
        { userId: email }
      );
      // Success - 202 Accepted
      return { result: 'SUCCESS', message: response.data.message };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Unknown error';
        
        // Map HTTP status codes to purchase results
        if (status === 403) {
          return { result: 'SOLD_OUT', message };
        } else if (status === 409) {
          return { result: 'ALREADY_PURCHASED', message };
        } else if (status === 400) {
          if (message.includes('not started')) {
            return { result: 'NOT_STARTED', message };
          } else if (message.includes('ended')) {
            return { result: 'ENDED', message };
          }
        } else if (status === 404) {
          return { result: 'NOT_FOUND', message };
        }
        return { result: 'NOT_FOUND', message };
      }
      throw error;
    }
  },

  // Check order status
  checkOrderStatus: async (saleId: string, email: string): Promise<OrderStatusResponse> => {
    const response = await api.get<OrderStatusResponse>(
      `/flash-sales/${saleId}/orders/${email}`
    );
    return response.data;
  },

  // Get all orders for a flash sale (winners)
  getOrders: async (saleId: string): Promise<Order[]> => {
    const response = await api.get<Order[]>(`/flash-sales/${saleId}/orders`);
    return response.data;
  },
};

// Helper to determine sale status
export const getSaleStatus = (sale: FlashSaleResponse): 'active' | 'ended' | 'not_started' => {
  const now = new Date();
  const startTime = new Date(sale.startTime);
  const endTime = new Date(sale.endTime);

  if (now < startTime) {
    return 'not_started';
  } else if (now > endTime) {
    return 'ended';
  }
  return 'active';
};

// Helper to get result message
export const getResultMessage = (result: PurchaseResult): string => {
  switch (result) {
    case 'SUCCESS':
      return 'Congratulations! Your order is being processed.';
    case 'SOLD_OUT':
      return 'Sorry, all items have been sold out.';
    case 'ALREADY_PURCHASED':
      return 'You have already purchased this item. You cannot buy it again.';
    case 'NOT_STARTED':
      return 'This sale has not started yet.';
    case 'ENDED':
      return 'This sale has already ended.';
    case 'NOT_FOUND':
      return 'Flash sale not found.';
    default:
      return 'An unknown error occurred.';
  }
};
