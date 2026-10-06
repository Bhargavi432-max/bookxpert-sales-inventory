import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { approvalsApi } from "../api/endpoints";
import type { ApprovalStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Pagination, StatusBadge, Table, Td, Th } from "../components/ui";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, formatMoney } from "../lib/format";
import clsx from "clsx";

const TABS: { label: string; value: ApprovalStatus | undefined }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: undefined },
];

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ApprovalStatus | undefined>("PENDING");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["approvals", { status, page }],
    queryFn: () => approvalsApi.list({ status, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Approvals" subtitle="Orders above the approval limit wait here for a manager's decision." />
      <Card>
        <div className="flex gap-1 border-b border-slate-100 px-4 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={clsx(
                "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium",
                status === tab.value ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data!.items.length === 0 ? (
          <EmptyState title={status === "PENDING" ? "Nothing waiting for approval" : "No approvals here"} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Requested</Th>
                  <Th>Decision</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data!.items.map((approval) => (
                  <tr key={approval.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/orders/${approval.order.id}`} className="font-medium text-indigo-600 hover:underline">
                        {approval.order.order_number}
                      </Link>
                      {approval.requested_by.id === user?.id && approval.status === "PENDING" && (
                        <div className="mt-1"><Badge>Raised by you</Badge></div>
                      )}
                    </Td>
                    <Td>{approval.order.customer.name}</Td>
                    <Td>
                      <p>{approval.requested_by.name}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(approval.requested_at)}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={approval.status} />
                      {approval.decided_by && (
                        <p className="mt-1 text-xs text-slate-500">
                          {approval.decided_by.name} · {formatDateTime(approval.decided_at!)}
                        </p>
                      )}
                    </Td>
                    <Td className="text-right">
                      <p className="font-medium">{formatMoney(approval.order.total_amount)}</p>
                      <p className="text-xs text-slate-500">limit {formatMoney(approval.threshold_amount)}</p>
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
