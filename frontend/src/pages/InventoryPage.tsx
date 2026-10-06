import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";

import { inventoryApi, productsApi } from "../api/endpoints";
import type { InventoryTxnType } from "../api/types";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Pagination, Select, StatusBadge, Table, Td, Th } from "../components/ui";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, humanize } from "../lib/format";

const TYPES: InventoryTxnType[] = ["SALE", "RESTOCK", "ADJUSTMENT", "INITIAL"];

export default function InventoryPage() {
  const [productId, setProductId] = useState<number | undefined>();
  const [txnType, setTxnType] = useState<InventoryTxnType | undefined>();
  const [page, setPage] = useState(1);
  const products = useQuery({ queryKey: ["products", "all-active"], queryFn: () => productsApi.list({ page_size: 100 }) });
  const query = useQuery({
    queryKey: ["inventory", { productId, txnType, page }],
    queryFn: () => inventoryApi.transactions({ product_id: productId, txn_type: txnType, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Inventory log" subtitle="Every stock movement – sales, restocks and adjustments – with the balance after it." />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Select className="w-64" value={productId ?? ""} onChange={(e) => { setProductId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}>
            <option value="">All products</option>
            {products.data?.items.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select className="w-48" value={txnType ?? ""} onChange={(e) => { setTxnType((e.target.value || undefined) as InventoryTxnType | undefined); setPage(1); }}>
            <option value="">All movements</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{humanize(t)}</option>
            ))}
          </Select>
        </div>
        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data!.items.length === 0 ? (
          <EmptyState title="No stock movements" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Product</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Change</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Reference</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data!.items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-slate-600">{formatDateTime(t.created_at)}</Td>
                    <Td>
                      <p className="font-medium">{t.product.name}</p>
                      <p className="text-xs text-slate-500">{t.product.sku}</p>
                    </Td>
                    <Td><StatusBadge status={t.txn_type} /></Td>
                    <Td className={clsx("text-right font-medium", t.quantity_change < 0 ? "text-red-600" : "text-emerald-700")}>
                      {t.quantity_change > 0 ? `+${t.quantity_change}` : t.quantity_change}
                    </Td>
                    <Td className="text-right">{t.balance_after}</Td>
                    <Td>
                      {t.order_id ? (
                        <Link to={`/orders/${t.order_id}`} className="text-indigo-600 hover:underline">{t.order_number}</Link>
                      ) : (
                        <span className="text-slate-600">{t.note}</span>
                      )}
                      {t.created_by && <p className="text-xs text-slate-500">by {t.created_by.name}</p>}
                    </Td>
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
