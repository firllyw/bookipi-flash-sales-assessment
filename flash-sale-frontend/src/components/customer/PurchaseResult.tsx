import React from 'react';
import type { PurchaseResult as PurchaseResultType } from '../../types';
import { getResultMessage } from '../../api/flash-sale-api';

interface PurchaseResultProps {
  result: PurchaseResultType | null;
}

export const PurchaseResult: React.FC<PurchaseResultProps> = ({ result }) => {
  if (!result) return null;

  const isSuccess = result === 'SUCCESS';
  const isWarning = result === 'NOT_STARTED';
  // ALREADY_PURCHASED, SOLD_OUT, ENDED, NOT_FOUND all fall through to error (red) styling

  const bgColor = isSuccess
    ? 'bg-green-50 border-green-200'
    : isWarning
    ? 'bg-yellow-50 border-yellow-200'
    : 'bg-red-50 border-red-200';

  const textColor = isSuccess
    ? 'text-green-800'
    : isWarning
    ? 'text-yellow-800'
    : 'text-red-800';

  const iconColor = isSuccess
    ? 'text-green-500'
    : isWarning
    ? 'text-yellow-500'
    : 'text-red-500';

  return (
    <div className={`mt-4 p-4 rounded-lg border ${bgColor}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${iconColor}`}>
          {isSuccess ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : isWarning ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div>
          <p className={`font-medium ${textColor}`}>
            {isSuccess ? 'Success!' : isWarning ? 'Notice' : 'Oops!'}
          </p>
          <p className={`text-sm mt-1 ${textColor}`}>{getResultMessage(result)}</p>
        </div>
      </div>
    </div>
  );
};
