import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";

import { ordersApi } from "../api/endpoints";
import type { Order } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, ErrorState, Field, LoadingBlock, Modal, PageHeader, StatusBadge, Table, Td, Textarea, Th } from "../components/ui";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, formatMoney } from "../lib/format";

type Action = "approve" | "reject" | "cancel";

const ACTION_COPY: Record<Action, { title: string; button: string; success: string }> = {
  approve: { title: "Approve order", button: "Approve & complete", success: "Order approved. Stock updated and the sales rep has been emailed." },
  reject: { title: "Reject order", button: "Reject order", success: "Order rejected. The sales rep has been emailed." },
  cancel: { title: "Cancel order", button: "Cancel order", success: "Order cancelled." },
};

function Timeline({ order }: { order: Order }) {
  const steps: { label: string; at: string | null; detail?: string }[] = [
    { label: `Raised by ${order.created_by.name}`, at: order.created_at },
  ];
  if (order.approval) {
    steps.push({ label: `Sent for approval (limit ${formatMoney(order.approval.threshold_amount)})`, at: order.approval.requested_at });
    if (order.approval.decided_at) {
      const verb = order.approval.status.toLowerCase();
      steps.push({ label: `${verb.charAt(0).toUpperCase() + verb.slice(1)} by ${order.approval.decided_by?.name}`, at: order.approval.decided_at, detail: order.approval.decision_comment ?? undefined });
    }
  }
  if (order.completed_at) steps.push({ label: "Completed, stock deducted", at: order.completed_at });

  return (
    <ol className="space-y-4 p-5">
      {steps.map((step, i) => (
        <li key={i} className="relative pl-6">
          <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500" />
          {i < steps.length - 1 && <span className="absolute left-[4px] top-4 h-full w-px bg-slate-200" />}
          <p className="text-sm font-medium">{step.label}</p>
          {step.at && <p className="text-xs text-slate-500">{formatDateTime(step.at)}</p>}
          {step.detail && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700">“{step.detail}”</p>}
        </li>
      ))}
    </ol>
  );
}

export default function OrderDetailPage() {
  const id = Number(useParams().id);
  const { user, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["orders", id], queryFn: () => ordersApi.get(id), enabled: Number.isFinite(id) });

  const mutation = useMutation({
    mutationFn: ({ action, comment }: { action: Action; comment: string }) =>
      action === "approve" ? ordersApi.approve(id, comment) : action === "reject" ? ordersApi.reject(id, comment) : ordersApi.cancel(id, comment),
    onSuccess: (order, vars) => {
      queryClient.setQueryData(["orders", id], order);
      for (const key of ["orders", "dashboard", "approvals", "products", "inventory"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(ACTION_COPY[vars.action].success);
      closeModal();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });

  const closeModal = () => {
    setAction(null);
    setComment("");
    setCommentError(null);
  };

  const submit = () => {
    if (action === "reject" && comment.trim().length < 3) {
      setCommentError("Please give the sales rep a reason (at least 3 characters)");
      return;
    }
    mutation.mutate({ action: action!, comment: comment.trim() });
  };

  if (query.isLoading) return <LoadingBlock />;
  if (query.error || !query.data) return <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />;

  const order = query.data;
  const pending = order.status === "PENDING_APPROVAL";
  const isCreator = order.created_by.id === user?.id;
  const canDecide = pending && isManager && !isCreator;
  const canCancel = pending && (isCreator || isManager);

  return (
    <>
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <PageHeader
        title={order.order_number}
        subtitle={`${order.customer.name} · ${formatDateTime(order.created_at)}`}
        actions={
          <>
            {canCancel && (
              <Button variant="secondary" onClick={() => setAction("cancel")}>
                Cancel order
              </Button>
            )}
            {canDecide && (
              <>
                <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setAction("reject")}>
                  Reject
                </Button>
                <Button variant="success" icon={<Check className="h-4 w-4" />} onClick={() => setAction("approve")}>
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />

      {pending && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isManager && isCreator
            ? "You raised this order, so another manager has to approve it."
            : isManager
              ? "This order is above the approval limit. Approving it deducts stock and completes the order."
              : "Waiting for manager approval. You'll get an email when it's decided."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Items" className="lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Unit price</Th>
                <Th className="text-right">Line total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.sku}</p>
                  </Td>
                  <Td className="text-right">{item.quantity}</Td>
                  <Td className="text-right">{formatMoney(item.unit_price)}</Td>
                  <Td className="text-right font-medium">{formatMoney(item.line_total)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <Td className="text-right font-medium" colSpan={3}>
                  Order total
                </Td>
                <Td className="text-right text-lg font-semibold">{formatMoney(order.total_amount)}</Td>
              </tr>
            </tfoot>
          </Table>
          {order.notes && (
            <div className="border-t border-slate-100 px-5 py-4 text-sm">
              <p className="font-medium text-slate-700">Notes</p>
              <p className="mt-1 whitespace-pre-line text-slate-600">{order.notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Status" action={<StatusBadge status={order.status} />}>
            <Timeline order={order} />
          </Card>
          <Card title="Customer">
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium">{order.customer.name}</p>
              <p className="text-slate-600">{order.customer.email}</p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={action !== null}
        title={action ? ACTION_COPY[action].title : ""}
        onClose={closeModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Back
            </Button>
            <Button variant={action === "approve" ? "success" : "danger"} loading={mutation.isPending} onClick={submit}>
              {action ? ACTION_COPY[action].button : ""}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          {order.order_number} · {order.customer.name} · <b>{formatMoney(order.total_amount)}</b>
        </p>
        <Field label={action === "reject" ? "Reason for rejection" : "Comment (optional)"} error={commentError ?? undefined}>
          <Textarea
            rows={3}
            value={comment}
            invalid={!!commentError}
            onChange={(e) => {
              setComment(e.target.value);
              setCommentError(null);
            }}
            maxLength={500}
            autoFocus
          />
        </Field>
      </Modal>
    </>
  );
}
