export type Role = "SALES" | "MANAGER";
export type OrderStatus = "PENDING_APPROVAL" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type InventoryTxnType = "INITIAL" | "SALE" | "RESTOCK" | "ADJUSTMENT";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserBrief {
  id: number;
  name: string;
  email: string;
}

export interface User extends UserBrief {
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface CustomerBrief {
  id: number;
  name: string;
  email: string;
}

export interface Customer extends CustomerBrief {
  phone: string;
  address: string | null;
  gstin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductBrief {
  id: number;
  sku: string;
  name: string;
}

export interface Product extends ProductBrief {
  description: string | null;
  unit_price: number;
  stock_quantity: number;
  reorder_level: number;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: number;
  product: ProductBrief;
  txn_type: InventoryTxnType;
  quantity_change: number;
  balance_after: number;
  order_id: number | null;
  order_number: string | null;
  note: string | null;
  created_by: UserBrief | null;
  created_at: string;
}

export interface Approval {
  id: number;
  status: ApprovalStatus;
  threshold_amount: number;
  requested_by: UserBrief;
  requested_at: string;
  decided_by: UserBrief | null;
  decided_at: string | null;
  decision_comment: string | null;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  customer: CustomerBrief;
  created_by: UserBrief;
  status: OrderStatus;
  total_amount: number;
  requires_approval: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface OrderItem {
  id: number;
  product: ProductBrief;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order extends OrderSummary {
  notes: string | null;
  items: OrderItem[];
  approval: Approval | null;
}

export interface ApprovalQueueItem extends Approval {
  order: OrderSummary;
}

export interface DashboardSummary {
  sales: {
    total_revenue: number;
    revenue_this_month: number;
    completed_orders: number;
    average_order_value: number;
    orders_today: number;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
    pending_value: number;
    avg_decision_hours: number | null;
  };
  inventory: {
    active_products: number;
    low_stock: number;
    out_of_stock: number;
    stock_value: number;
  };
  orders_by_status: Record<OrderStatus, number>;
  sales_trend: { date: string; revenue: number; orders: number }[];
  top_products: { product_id: number; sku: string; name: string; quantity_sold: number; revenue: number }[];
  low_stock_products: Product[];
  recent_orders: OrderSummary[];
  approval_threshold: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}
