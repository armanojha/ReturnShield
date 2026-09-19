import type { RiskSignal, SignalEvaluator } from '../types';
import { evaluateCategory } from './category';
import { evaluateCustomer } from './customer';
import { evaluateListing } from './listing';
import { evaluateReturn } from './return';
import { evaluateSeller } from './seller';

export { evaluateCategory, evaluateCustomer, evaluateListing, evaluateReturn, evaluateSeller };

/** Fixed evaluation and output order: seller, listing, customer, return, category. */
export const SIGNAL_EVALUATORS: readonly (readonly [RiskSignal, SignalEvaluator])[] = [
  ['seller', evaluateSeller],
  ['listing', evaluateListing],
  ['customer', evaluateCustomer],
  ['return', evaluateReturn],
  ['category', evaluateCategory],
];
