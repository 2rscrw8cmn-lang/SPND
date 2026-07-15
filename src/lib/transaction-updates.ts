export type TransactionAllocationInput = { categoryId: string; amountCents: number };

export function allocationsBalance(transactionAmountCents: number, allocations: TransactionAllocationInput[]) {
  return allocations.length >= 2
    && allocations.every((allocation) => Number.isInteger(allocation.amountCents) && allocation.amountCents !== 0)
    && allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) === transactionAmountCents;
}
