import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ordersApi } from "../api/endpoints";
import type { OrderStatus } from "../api/types";
import { Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Pagination, Select, StatusBadge, Table, Td, Th } from "../components/ui";
import { useDebounced } from "../lib/useDebounced";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, formatMoney, humanize } from "../lib/format";

const STATUSES: OrderStatus[] = ["PENDING_APPROVAL", "COMPLETED", "REJECTED", "CANCELLED"];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as OrderStatus | null) ?? undefined;
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const query = useQuery({
    queryKey: ["orders", { page, status, search: debouncedSearch, mine }],
    queryFn: () => ordersApi.list({ page, status, search: debouncedSearch, mine: mine || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Sales orders"
        subtitle="Every order raised, with its approval state."
        actions={
          <Link to="/orders/new">
            <Button icon={<Plus className="h-4 w-4" />}>New order</Button>
          </Link>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search order number or customer"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-48"
            value={status ?? ""}
            onChange={(e) => {
              setParams(e.target.value ? { status: e.target.value } : {});
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
            Only my orders
          </label>
        </div>

        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data!.items.length === 0 ? (
          <EmptyState title="No orders found" message="Try a different filter, or raise a new order." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Raised by</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data!.items.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/orders/${order.id}`} className="font-medium text-indigo-600 hover:underline">
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
                    </Td>
                    <Td>{order.customer.name}</Td>
                    <Td className="text-slate-600">{order.created_by.name}</Td>
                    <Td><StatusBadge status={order.status} /></Td>
                    <Td className="text-right font-medium">{formatMoney(order.total_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={query.data!.page_size} total={query.data!.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
