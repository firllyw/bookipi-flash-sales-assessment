import React, { useState } from 'react';
import { Button, Input } from '../common';
import type { CreateFlashSaleDto } from '../../types';

interface CreateSaleFormProps {
  onSubmit: (data: CreateFlashSaleDto) => Promise<void>;
  loading: boolean;
}

export const CreateSaleForm: React.FC<CreateSaleFormProps> = ({
  onSubmit,
  loading,
}) => {
  const [formData, setFormData] = useState({
    productId: '',
    stock: '',
    startTime: '',
    endTime: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.productId.trim()) {
      newErrors.productId = 'Product ID is required';
    }

    const stockNum = parseInt(formData.stock, 10);
    if (isNaN(stockNum) || stockNum <= 0) {
      newErrors.stock = 'Stock must be a positive number';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (end <= start) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const dto: CreateFlashSaleDto = {
      productId: formData.productId.trim(),
      stock: parseInt(formData.stock, 10),
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
    };

    await onSubmit(dto);
  };

  // Set default times (now + 5 minutes for start, now + 1 hour for end)
  const setDefaultTimes = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60 * 1000);
    const end = new Date(now.getTime() + 60 * 60 * 1000);

    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };

    setFormData((prev) => ({
      ...prev,
      startTime: formatDateTime(start),
      endTime: formatDateTime(end),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Product ID / Name"
        name="productId"
        value={formData.productId}
        onChange={handleChange}
        placeholder="e.g., iPhone 15 Pro"
        error={errors.productId}
      />

      <Input
        label="Stock Quantity"
        name="stock"
        type="number"
        min="1"
        value={formData.stock}
        onChange={handleChange}
        placeholder="e.g., 100"
        error={errors.stock}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Start Time"
          name="startTime"
          type="datetime-local"
          value={formData.startTime}
          onChange={handleChange}
          error={errors.startTime}
        />

        <Input
          label="End Time"
          name="endTime"
          type="datetime-local"
          value={formData.endTime}
          onChange={handleChange}
          error={errors.endTime}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={setDefaultTimes}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Set default times (5 min from now, 1 hour duration)
        </button>
      </div>

      <div className="flex gap-4">
        <Button type="submit" variant="primary" loading={loading} className="flex-1">
          Create Flash Sale
        </Button>
      </div>
    </form>
  );
};
