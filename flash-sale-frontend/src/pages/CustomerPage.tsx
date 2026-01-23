import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common';
import { SaleStatus, PurchaseForm, PurchaseResult } from '../components/customer';
import { flashSaleApi, getSaleStatus } from '../api/flash-sale-api';
import type { FlashSaleResponse, PurchaseResult as PurchaseResultType } from '../types';

export const CustomerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState<FlashSaleResponse[]>([]);
  const [selectedSale, setSelectedSale] = useState<FlashSaleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResultType | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get email from URL query params
  const currentEmail = searchParams.get('email');

  // Check if user has already purchased
  const checkExistingPurchase = useCallback(async (saleId: string, email: string) => {
    try {
      const status = await flashSaleApi.checkOrderStatus(saleId, email);
      if (status.secured) {
        setPurchaseResult('SUCCESS');
      }
    } catch (err) {
      console.error('Failed to check order status', err);
    }
  }, []);

  // Fetch sales list
  const fetchSales = useCallback(async () => {
    try {
      const data = await flashSaleApi.getFlashSales();
      setSales(data);
      
      // If we have an ID, select that sale
      if (id) {
        const sale = data.find((s) => s.id === id);
        if (sale) {
          setSelectedSale(sale);
          // Check if user already purchased (if email is in URL)
          if (currentEmail) {
            await checkExistingPurchase(sale.id, currentEmail);
          }
        } else {
          // Try fetching directly
          try {
            const saleData = await flashSaleApi.getFlashSale(id);
            setSelectedSale(saleData);
            // Check if user already purchased (if email is in URL)
            if (currentEmail) {
              await checkExistingPurchase(saleData.id, currentEmail);
            }
          } catch {
            setError('Flash sale not found');
          }
        }
      }
    } catch (err) {
      setError('Failed to load flash sales');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, currentEmail, checkExistingPurchase]);

  // Poll for updates when a sale is selected
  useEffect(() => {
    fetchSales();

    // Poll every 2 seconds for stock updates
    const interval = setInterval(async () => {
      if (selectedSale) {
        try {
          const updated = await flashSaleApi.getFlashSale(selectedSale.id);
          setSelectedSale(updated);
        } catch (err) {
          console.error('Failed to refresh sale data', err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchSales, selectedSale?.id]);

  const handleSelectSale = (sale: FlashSaleResponse) => {
    setSelectedSale(sale);
    setPurchaseResult(null);
    navigate(`/sale/${sale.id}`);
  };

  const handlePurchase = async (email: string) => {
    if (!selectedSale) return;

    setPurchasing(true);
    setPurchaseResult(null);

    try {
      const response = await flashSaleApi.purchase(selectedSale.id, email);
      setPurchaseResult(response.result);

      // Save email to URL params only on actual success
      if (response.result === 'SUCCESS') {
        setSearchParams({ email });
      }

      // Refresh sale data to get updated stock
      const updated = await flashSaleApi.getFlashSale(selectedSale.id);
      setSelectedSale(updated);
    } catch (err) {
      console.error('Purchase failed', err);
      setPurchaseResult('NOT_FOUND' as PurchaseResultType);
    } finally {
      setPurchasing(false);
    }
  };

  const isPurchaseDisabled = () => {
    if (!selectedSale) return true;
    const status = getSaleStatus(selectedSale);
    return status !== 'active' || selectedSale.currentStock === 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Flash Sale</h1>
          <p className="text-gray-600 mt-2">Limited time offers</p>
        </div>

        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {/* Sale Selector (if no specific sale is selected) */}
        {!selectedSale && sales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Sales</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {sales.map((sale) => {
                const status = getSaleStatus(sale);
                return (
                  <button
                    key={sale.id}
                    onClick={() => handleSelectSale(sale)}
                    className="w-full p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sale.productId}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sale.currentStock} / {sale.stock} remaining
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : status === 'not_started'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {status === 'active'
                          ? 'Active'
                          : status === 'not_started'
                          ? 'Upcoming'
                          : 'Ended'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {sales.length === 0 && !selectedSale && (
          <Card className="text-center py-12">
            <p className="text-gray-500">No flash sales available at the moment.</p>
          </Card>
        )}

        {/* Selected Sale Details */}
        {selectedSale && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedSale.productId}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Flash Sale</p>
                </div>
                {sales.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedSale(null);
                      setPurchaseResult(null);
                      navigate('/');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Change Sale
                  </button>
                )}
              </div>
            </CardHeader>

            <SaleStatus sale={selectedSale} />

            <div className="border-t border-gray-100 mt-6 pt-6">
              {/* Show success state only for actual successful purchase */}
              {purchaseResult === 'SUCCESS' ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Purchase Successful!
                  </h3>
                  <p className="text-gray-600">
                    You have successfully secured this item. Your order is being processed.
                  </p>
                  {currentEmail && (
                    <p className="text-sm text-gray-500 mt-2">
                      Logged in as: <span className="font-medium">{currentEmail}</span>
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setSearchParams({});
                      setPurchaseResult(null);
                    }}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Try with different email
                  </button>
                </div>
              ) : /* Show sold out state */ selectedSale.currentStock === 0 ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                    <svg
                      className="w-8 h-8 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    Sold Out!
                  </h3>
                  <p className="text-gray-600">
                    All items have been sold. Better luck next time!
                  </p>
                </div>
              ) : /* Show ended state */ getSaleStatus(selectedSale) === 'ended' ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <svg
                      className="w-8 h-8 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Sale Ended
                  </h3>
                  <p className="text-gray-600">
                    This flash sale has ended with {selectedSale.currentStock} item{selectedSale.currentStock !== 1 ? 's' : ''} remaining.
                  </p>
                </div>
              ) : /* Show not started state */ getSaleStatus(selectedSale) === 'not_started' ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                    <svg
                      className="w-8 h-8 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    Coming Soon
                  </h3>
                  <p className="text-gray-600">
                    This flash sale has not started yet. Check back when it begins!
                  </p>
                </div>
              ) : (
                /* Show purchase form for active sales */
                <>
                  <PurchaseForm
                    onPurchase={handlePurchase}
                    loading={purchasing}
                    disabled={isPurchaseDisabled()}
                    initialEmail={currentEmail || ''}
                  />
                  <PurchaseResult result={purchaseResult} />
                </>
              )}
            </div>
          </Card>
        )}

        {/* Link to Admin */}
        <div className="mt-8 text-center">
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};
