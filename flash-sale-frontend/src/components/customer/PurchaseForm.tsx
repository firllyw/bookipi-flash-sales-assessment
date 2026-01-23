import React, { useState, useEffect } from 'react';
import { Button, Input } from '../common';

interface PurchaseFormProps {
  onPurchase: (email: string) => Promise<void>;
  loading: boolean;
  disabled: boolean;
  initialEmail?: string;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  onPurchase,
  loading,
  disabled,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');

  // Update email when initialEmail changes
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    await onPurchase(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        label="Enter your email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        disabled={disabled || loading}
      />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        disabled={disabled}
        className="w-full"
      >
        BUY NOW
      </Button>
    </form>
  );
};
