import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, Button } from '../../components/common';
import { SalesList } from '../../components/admin';
import { flashSaleApi } from '../../api/flash-sale-api';
import type { FlashSaleResponse } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [sales, setSales] = useState<FlashSaleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const data = await flashSaleApi.getFlashSales();
        setSales(data);
      } catch (err) {
        setError('Failed to load flash sales');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Flash Sales Admin</h1>
            <p className="text-gray-600 mt-1">Manage your flash sales</p>
          </div>
          <Link to="/admin/create">
            <Button variant="primary">+ New Sale</Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{sales.length}</p>
              <p className="text-gray-600">Total Sales</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {sales.filter((s) => {
                  const now = new Date();
                  return (
                    new Date(s.startTime) <= now && new Date(s.endTime) >= now
                  );
                }).length}
              </p>
              <p className="text-gray-600">Active Sales</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {sales.reduce((acc, s) => acc + (s.stock - s.currentStock), 0)}
              </p>
              <p className="text-gray-600">Total Items Sold</p>
            </div>
          </Card>
        </div>

        {/* Error */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {/* Sales List */}
        <Card padding="none">
          <CardHeader className="px-6 pt-6">
            <CardTitle>All Flash Sales</CardTitle>
          </CardHeader>
          <SalesList sales={sales} loading={loading} />
        </Card>

        {/* Back to Customer View */}
        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
            Back to Customer View
          </Link>
        </div>
      </div>
    </div>
  );
};
