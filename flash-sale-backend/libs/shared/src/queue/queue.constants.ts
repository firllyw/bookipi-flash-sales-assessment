export const ORDERS_QUEUE = 'orders';

export const QUEUE_DEFAULT_OPTIONS = {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: true,
  },
};
