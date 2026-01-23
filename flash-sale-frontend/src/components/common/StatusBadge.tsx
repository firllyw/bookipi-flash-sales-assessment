import React from 'react';

type StatusType = 'active' | 'ended' | 'not_started' | 'success' | 'error' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
}) => {
  const statusConfig: Record<StatusType, { bg: string; text: string; defaultLabel: string }> = {
    active: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      defaultLabel: 'Active',
    },
    ended: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      defaultLabel: 'Ended',
    },
    not_started: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      defaultLabel: 'Pending',
    },
    success: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      defaultLabel: 'Success',
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      defaultLabel: 'Error',
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      defaultLabel: 'Warning',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${config.bg} ${config.text} ${className}
      `}
    >
      {label || config.defaultLabel}
    </span>
  );
};
