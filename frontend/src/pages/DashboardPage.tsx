import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, IndianRupee, Package, Plus, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { dashboardApi } from "../api/endpoints";
import type { OrderStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge, Table, Td, Th } from "../components/ui";
import { getErrorMessage } from "../lib/errors";
import { formatDate, formatDateTime, formatMoney, formatMoneyCompact } from "../lib/format";

function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: ReactNode; icon: ReactNode; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      </div>
      {sub && <div className="mt-3 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

const STATUS_BAR: Record<OrderStatus, string> = {
  COMPLETED: "bg-emerald-500",
  PENDING_APPROVAL: "bg-amber-400",
  REJECTED: "bg-red-500",
  CANCELLED: "bg-slate-400",
};

export default function DashboardPage() {
  const { user, isManager } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });

  if (isLoading) return <LoadingBlock />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} onRetry={refetch} />;

  const { sales, approvals, inventory } = data;
  const totalOrders = Object.values(data.orders_by_status).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0]}`}
        subtitle={`Orders above ${formatMoney(data.approval_threshold)} need manager approval.`}
        actions={
          <Link to="/orders/new">
            <Button icon={<Plus className="h-4 w-4" />}>New order</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total revenue"
          value={formatMoney(sales.total_revenue)}
          sub={<>This month: <b className="text-slate-700">{formatMoney(sales.revenue_this_month)}</b></>}
          icon={<IndianRupee className="h-5 w-5 text-emerald-700" />}
          tone="bg-emerald-50"
        />
        <Kpi
          label="Completed orders"
          value={String(sales.completed_orders)}
          sub={<>Avg. value {formatMoney(sales.average_order_value)} · {sales.orders_today} raised today</>}
          icon={<ShoppingCart className="h-5 w-5 text-indigo-700" />}
          tone="bg-indigo-50"
        />
        <Kpi
          label="Pending approvals"
          value={String(approvals.pending)}
          sub={
            <>
              {formatMoney(approvals.pending_value)} awaiting review
              {approvals.avg_decision_hours !== null && <> · avg. decision {approvals.avg_decision_hours} h</>}
            </>
          }
          icon={<ClipboardCheck className="h-5 w-5 text-amber-700" />}
          tone="bg-amber-50"
        />
        <Kpi
          label="Stock alerts"
          value={String(inventory.low_stock)}
          sub={<>{inventory.out_of_stock} out of stock · {inventory.active_products} active products</>}
          icon={<AlertTriangle className="h-5 w-5 text-red-700" />}
          tone="bg-red-50"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Sales – last 30 days" className="xl:col-span-2">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sales_trend} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d).slice(0, 6)} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v: number) => formatMoneyCompact(v)} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  formatter={(value, name) => (name === "revenue" ? [formatMoney(Number(value)), "Revenue"] : [value, "Orders"])}
                  labelFormatter={(label) => formatDate(String(label))}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Orders by status">
          <div className="space-y-4 p-5">
            {(Object.keys(STATUS_BAR) as OrderStatus[]).map((status) => {
              const count = data.orders_by_status[status] ?? 0;
              const pct = totalOrders ? (count / totalOrders) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-sm">
                    <StatusBadge status={status} />
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${STATUS_BAR[status]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div>
                <p className="text-slate-500">Approved</p>
                <p className="text-lg font-semibold text-emerald-700">{approvals.approved}</p>
              </div>
              <div>
                <p className="text-slate-500">Rejected</p>
                <p className="text-lg font-semibold text-red-700">{approvals.rejected}</p>
              </div>
            </div>
            {isManager && approvals.pending > 0 && (
              <Link to="/approvals" className="block text-sm font-medium text-indigo-600 hover:underline">
                Review {approvals.pending} pending approval{approvals.pending > 1 ? "s" : ""} →
              </Link>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Recent orders" className="xl:col-span-2" action={<Link to="/orders" className="text-sm text-indigo-600 hover:underline">View all</Link>}>
          {data.recent_orders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/orders/${order.id}`} className="font-medium text-indigo-600 hover:underline">
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
                    </Td>
                    <Td>{order.customer.name}</Td>
                    <Td><StatusBadge status={order.status} /></Td>
                    <Td className="text-right font-medium">{formatMoney(order.total_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Top products">
            {data.top_products.length === 0 ? (
              <EmptyState title="No sales yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.top_products.map((p) => (
                  <li key={p.product_id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.quantity_sold} sold</p>
                    </div>
                    <span className="font-medium">{formatMoneyCompact(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Low stock" action={<Link to="/products?low_stock=1" className="text-sm text-indigo-600 hover:underline">View</Link>}>
            {data.low_stock_products.length === 0 ? (
              <EmptyState title="All products are well stocked" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.low_stock_products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Package className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <Badge tone={p.stock_quantity === 0 ? "red" : "amber"}>
                      {p.stock_quantity} / {p.reorder_level}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">Stock value on hand: {formatMoney(inventory.stock_value)}</p>
    </>
  );
}
