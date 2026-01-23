import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../../components/common';
import { CreateSaleForm } from '../../components/admin';
import { flashSaleApi } from '../../api/flash-sale-api';
import type { CreateFlashSaleDto } from '../../types';

export const CreateSale: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CreateFlashSaleDto) => {
    setLoading(true);
    setError(null);

    try {
      const sale = await flashSaleApi.createFlashSale(data);
      navigate(`/admin/sale/${sale.id}`);
    } catch (err) {
      setError('Failed to create flash sale. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
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
          <h1 className="text-3xl font-bold text-gray-900">Create Flash Sale</h1>
          <p className="text-gray-600 mt-1">Set up a new limited-time offer</p>
        </div>

        {/* Error */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sale Details</CardTitle>
          </CardHeader>
          <CreateSaleForm onSubmit={handleSubmit} loading={loading} />
        </Card>
      </div>
    </div>
  );
};
