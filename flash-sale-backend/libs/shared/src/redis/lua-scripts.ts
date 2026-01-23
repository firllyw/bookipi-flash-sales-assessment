/**
 * Lua script for atomic flash sale purchase
 *
 * KEYS[1]: Stock count key (e.g., flashsale:{id}:stock)
 * KEYS[2]: Winners set key (e.g., flashsale:{id}:winners)
 *
 * ARGV[1]: userId
 * ARGV[2]: requestedQty (must be 1)
 *
 * Returns:
 *   1: Success - stock decremented, user added to winners
 *   0: Sold out
 *  -1: Invalid quantity (not exactly 1)
 *  -2: User already purchased
 */
export const FLASH_SALE_PURCHASE_SCRIPT = `
local stock = tonumber(redis.call('get', KEYS[1]))
local isWinner = redis.call('sismember', KEYS[2], ARGV[1])

-- 1. Validate quantity (System requirement: exactly 1)
if tonumber(ARGV[2]) ~= 1 then
    return -1 -- Code for invalid quantity
end

-- 2. Check if user already won
if isWinner == 1 then
    return -2 -- Code for duplicate purchase attempt
end

-- 3. Check stock and decrement
if stock and stock > 0 then
    redis.call('decr', KEYS[1])
    redis.call('sadd', KEYS[2], ARGV[1])
    return 1 -- SUCCESS
else
    return 0 -- SOLD OUT
end
`;

export enum PurchaseResult {
  SUCCESS = 1,
  SOLD_OUT = 0,
  INVALID_QUANTITY = -1,
  ALREADY_PURCHASED = -2,
}
