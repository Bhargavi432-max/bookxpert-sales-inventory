import { api } from "./client";
import type {
  ApprovalQueueItem,
  ApprovalStatus,
  Customer,
  DashboardSummary,
  InventoryTransaction,
  InventoryTxnType,
  LoginResponse,
  Order,
  OrderStatus,
  OrderSummary,
  Page,
  Product,
  Role,
  User,
} from "./types";

type Params = Record<string, string | number | boolean | undefined>;

const clean = (params: Params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

const get = <T>(url: string, params: Params = {}) => api.get<T>(url, { params: clean(params) }).then((r) => r.data);
const post = <T>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data);
const patch = <T>(url: string, body: unknown) => api.patch<T>(url, body).then((r) => r.data);
const put = <T>(url: string, body: unknown) => api.put<T>(url, body).then((r) => r.data);

export interface ProductInput {
  sku?: string;
  name: string;
  description?: string | null;
  unit_price: number;
  reorder_level: number;
  initial_stock?: number;
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  gstin?: string | null;
}

export interface StockAdjustmentInput {
  txn_type: "RESTOCK" | "ADJUSTMENT";
  quantity_change: number;
  note: string;
}

export interface OrderInput {
  customer_id: number;
  items: { product_id: number; quantity: number }[];
  notes?: string;
}

export interface UserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export const authApi = {
  login: (email: string, password: string) => post<LoginResponse>("/auth/login", { email, password }),
  me: () => get<User>("/auth/me"),
};

export const dashboardApi = {
  summary: () => get<DashboardSummary>("/dashboard/summary"),
};

export const productsApi = {
  list: (params: { page?: number; search?: string; include_inactive?: boolean; low_stock?: boolean; page_size?: number }) =>
    get<Page<Product>>("/products", params),
  create: (body: ProductInput) => post<Product>("/products", body),
  update: (id: number, body: Partial<ProductInput> & { is_active?: boolean }) => patch<Product>(`/products/${id}`, body),
  deactivate: (id: number) => api.delete(`/products/${id}`),
  adjustStock: (id: number, body: StockAdjustmentInput) => post<Product>(`/products/${id}/stock-adjustments`, body),
};

export const customersApi = {
  list: (params: { page?: number; search?: string; include_inactive?: boolean; page_size?: number }) =>
    get<Page<Customer>>("/customers", params),
  create: (body: CustomerInput) => post<Customer>("/customers", body),
  update: (id: number, body: Partial<CustomerInput> & { is_active?: boolean }) => patch<Customer>(`/customers/${id}`, body),
  deactivate: (id: number) => api.delete(`/customers/${id}`),
};

export const ordersApi = {
  list: (params: { page?: number; status?: OrderStatus; search?: string; mine?: boolean }) =>
    get<Page<OrderSummary>>("/orders", params),
  get: (id: number) => get<Order>(`/orders/${id}`),
  create: (body: OrderInput) => post<Order>("/orders", body),
  approve: (id: number, comment?: string) => post<Order>(`/orders/${id}/approve`, { comment: comment || null }),
  reject: (id: number, comment: string) => post<Order>(`/orders/${id}/reject`, { comment }),
  cancel: (id: number, comment?: string) => post<Order>(`/orders/${id}/cancel`, { comment: comment || null }),
};

export const approvalsApi = {
  list: (params: { page?: number; status?: ApprovalStatus }) => get<Page<ApprovalQueueItem>>("/approvals", params),
};

export const inventoryApi = {
  transactions: (params: { page?: number; product_id?: number; txn_type?: InventoryTxnType }) =>
    get<Page<InventoryTransaction>>("/inventory/transactions", params),
};

export const usersApi = {
  list: (params: { page?: number; search?: string }) => get<Page<User>>("/users", params),
  create: (body: UserInput) => post<User>("/users", body),
  update: (id: number, body: Partial<Omit<UserInput, "email">> & { is_active?: boolean }) => patch<User>(`/users/${id}`, body),
};

export const settingsApi = {
  get: () => get<{ approval_threshold: number }>("/settings"),
  updateThreshold: (approval_threshold: number) =>
    put<{ approval_threshold: number }>("/settings/approval-threshold", { approval_threshold }),
};
