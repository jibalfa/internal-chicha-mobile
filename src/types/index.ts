export const ROLES = {
  OWNER: "OWNER",
  CASHIER: "CASHIER",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

export const PRODUCT_TYPES = {
  ACCESSORY: "ACCESSORY",
  GENERAL: "GENERAL",
} as const;

export type ProductType = (typeof PRODUCT_TYPES)[keyof typeof PRODUCT_TYPES];

export const MOVEMENT_TYPES = {
  INITIAL_STOCK: "INITIAL_STOCK",
  PURCHASE: "PURCHASE",
  SALE: "SALE",
  ADJUSTMENT: "ADJUSTMENT",
  RETURN: "RETURN",
} as const;

export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

export const VOUCHER_MOVEMENT_TYPES = {
  INITIAL_STOCK: "INITIAL_STOCK",
  STOCK_IN: "STOCK_IN",
  SOLD: "SOLD",
  ADJUSTMENT: "ADJUSTMENT",
} as const;

export type VoucherMovementType = (typeof VOUCHER_MOVEMENT_TYPES)[keyof typeof VOUCHER_MOVEMENT_TYPES];

export const DIGITAL_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

export type DigitalStatus = (typeof DIGITAL_STATUS)[keyof typeof DIGITAL_STATUS];

export const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_METHOD = {
  CASH: "CASH",
  TRANSFER: "TRANSFER",
  QRIS: "QRIS",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export interface AuthSession {
  userId: string;
  name: string;
  username: string;
  role: RoleType;
}
