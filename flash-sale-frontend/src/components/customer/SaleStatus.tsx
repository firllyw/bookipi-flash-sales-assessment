import React from 'react';
import { StatusBadge } from '../common';
import type { FlashSaleResponse } from '../../types';
import { getSaleStatus } from '../../api/flash-sale-api';

interface SaleStatusProps {
  sale: FlashSaleResponse;
}

export const SaleStatus: React.FC<SaleStatusProps> = ({ sale }) => {
  const status = getSaleStatus(sale);
  const soldCount = sale.stock - sale.currentStock;
  const percentageSold = (soldCount / sale.stock) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Status</span>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Stock Remaining</span>
          <span className="font-semibold">
            {sale.currentStock} / {sale.stock}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              sale.currentStock === 0
                ? 'bg-red-500'
                : sale.currentStock < sale.stock * 0.2
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${100 - percentageSold}%` }}
          ></div>
        </div>
      </div>

      <CountdownTimer sale={sale} status={status} />
    </div>
  );
};

interface CountdownTimerProps {
  sale: FlashSaleResponse;
  status: 'active' | 'ended' | 'not_started';
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ sale, status }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>('');

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const targetTime =
        status === 'not_started'
          ? new Date(sale.startTime)
          : new Date(sale.endTime);

      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0) {
        return status === 'not_started' ? 'Starting soon...' : 'Sale ended';
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      }
      return `${minutes}m ${seconds}s`;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [sale, status]);

  if (status === 'ended') {
    return (
      <div className="text-center py-2 bg-gray-100 rounded-lg">
        <span className="text-gray-600">Sale has ended</span>
      </div>
    );
  }

  return (
    <div className="text-center py-2 bg-blue-50 rounded-lg">
      <span className="text-gray-600">
        {status === 'not_started' ? 'Starts in: ' : 'Ends in: '}
      </span>
      <span className="font-bold text-blue-600">{timeLeft}</span>
    </div>
  );
};
