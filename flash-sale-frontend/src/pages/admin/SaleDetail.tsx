import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, StatusBadge } from '../../components/common';
import { WinnersTable } from '../../components/admin';
import { flashSaleApi, getSaleStatus } from '../../api/flash-sale-api';
import type { FlashSaleResponse, Order } from '../../types';

export const SaleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<FlashSaleResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const saleData = await flashSaleApi.getFlashSale(id);
        setSale(saleData);
      } catch (err) {
        setError('Failed to load flash sale');
        console.error(err);
      } finally {
        setLoading(false);
      }

      // Fetch orders
      try {
        const ordersData = await flashSaleApi.getOrders(id);
        setOrders(ordersData);
      } catch (err) {
        console.error('Failed to load orders', err);
        // Don't show error for orders, just show empty list
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchData();

    // Poll for updates every 5 seconds
    const interval = setInterval(async () => {
      if (!id) return;
      try {
        const saleData = await flashSaleApi.getFlashSale(id);
        setSale(saleData);
        const ordersData = await flashSaleApi.getOrders(id);
        setOrders(ordersData);
      } catch (err) {
        console.error('Failed to refresh data', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="bg-red-50 border-red-200">
            <p className="text-red-600">{error || 'Sale not found'}</p>
            <Link
              to="/admin"
              className="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              Back to Dashboard
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const status = getSaleStatus(sale);
  const soldCount = sale.stock - sale.currentStock;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Sale Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{sale.productId}</CardTitle>
                <p className="text-sm text-gray-500 mt-1 font-mono">{sale.id}</p>
              </div>
              <StatusBadge status={status} />
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">{sale.stock}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining</p>
              <p className="text-2xl font-bold text-blue-600">{sale.currentStock}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sold</p>
              <p className="text-2xl font-bold text-green-600">{soldCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sell Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {sale.stock > 0 ? Math.round((soldCount / sale.stock) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Start Time</p>
              <p className="font-medium">{new Date(sale.startTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End Time</p>
              <p className="font-medium">{new Date(sale.endTime).toLocaleString()}</p>
            </div>
          </div>

          {/* Stock Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Stock Sold</span>
              <span className="font-medium">
                {soldCount} / {sale.stock}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${(soldCount / sale.stock) * 100}%` }}
              ></div>
            </div>
          </div>
        </Card>

        {/* Winners Table */}
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <CardTitle>
              Winners ({orders.length})
            </CardTitle>
          </CardHeader>
          <WinnersTable orders={orders} loading={ordersLoading} />
        </Card>

        {/* Customer Link */}
        <div className="mt-6 text-center">
          <Link
            to={`/sale/${sale.id}`}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            View Customer Page for this Sale
          </Link>
        </div>
      </div>
    </div>
  );
};
