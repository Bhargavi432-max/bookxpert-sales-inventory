import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { customersApi, ordersApi, productsApi, settingsApi } from "../api/endpoints";
import { Button, Card, Field, Input, LoadingBlock, PageHeader, Select, Textarea } from "../components/ui";
import { applyFieldErrors, getErrorMessage } from "../lib/errors";
import { formatMoney } from "../lib/format";

const schema = z.object({
  customer_id: z.number({ error: "Choose a customer" }).int().positive("Choose a customer"),
  items: z
    .array(
      z.object({
        product_id: z.number({ error: "Choose a product" }).int().positive("Choose a product"),
        quantity: z.number({ error: "Enter a quantity" }).int("Whole numbers only").min(1, "At least 1").max(10000, "Too large"),
      }),
    )
    .min(1, "Add at least one product"),
  notes: z.string().max(500, "Keep notes under 500 characters").optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: ["customers", "all-active"], queryFn: () => customersApi.list({ page_size: 100 }) });
  const products = useQuery({ queryKey: ["products", "all-active"], queryFn: () => productsApi.list({ page_size: 100 }) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ product_id: 0, quantity: 1 }], notes: "" },
  });
  const { register, control, handleSubmit, formState, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const productMap = useMemo(() => new Map(products.data?.items.map((p) => [p.id, p]) ?? []), [products.data]);

  const lines = (items ?? []).map((item) => {
    const product = productMap.get(item.product_id);
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
    return { product, qty, total: product ? product.unit_price * qty : 0 };
  });
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const threshold = settings.data?.approval_threshold;
  const needsApproval = threshold !== undefined && total > threshold;
  const stockProblems = lines.filter((l) => l.product && l.qty > l.product.stock_quantity);

  const create = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      if (order.status === "PENDING_APPROVAL") {
        toast.success(`${order.order_number} sent for manager approval`);
      } else {
        toast.success(`${order.order_number} completed`);
      }
      navigate(`/orders/${order.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  if (customers.isLoading || products.isLoading) return <LoadingBlock />;

  const onSubmit = handleSubmit((values) =>
    create.mutate({ ...values, notes: values.notes?.trim() || undefined }),
  );

  return (
    <>
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <PageHeader title="New sales order" subtitle="Stock is checked now, and again when the order is fulfilled." />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Customer" className="p-0">
            <div className="p-5">
              <Field label="Customer" error={formState.errors.customer_id?.message}>
                <Select invalid={!!formState.errors.customer_id} defaultValue="" {...register("customer_id", { valueAsNumber: true })}>
                  <option value="" disabled>
                    Select a customer…
                  </option>
                  {customers.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Products">
            <div className="space-y-3 p-5">
              {fields.map((field, index) => {
                const line = lines[index];
                const errors = formState.errors.items?.[index];
                const overStock = line?.product && line.qty > line.product.stock_quantity;
                return (
                  <div key={field.id} className="grid grid-cols-12 items-start gap-3 rounded-lg border border-slate-200 p-3">
                    <Field label="Product" error={errors?.product_id?.message} className="col-span-12 sm:col-span-6">
                      <Select invalid={!!errors?.product_id} {...register(`items.${index}.product_id`, { valueAsNumber: true })}>
                        <option value={0} disabled>
                          Select a product…
                        </option>
                        {products.data?.items.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stock_quantity === 0}>
                            {p.name} ({p.stock_quantity} in stock)
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Qty"
                      error={errors?.quantity?.message ?? (overStock ? `Only ${line.product!.stock_quantity} available` : undefined)}
                      className="col-span-5 sm:col-span-2"
                    >
                      <Input type="number" min={1} invalid={!!errors?.quantity || !!overStock} {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    </Field>
                    <div className="col-span-5 sm:col-span-3">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Line total</span>
                      <p className="py-2 text-sm font-medium">{line?.product ? formatMoney(line.total) : "—"}</p>
                      {line?.product && <p className="text-xs text-slate-500">@ {formatMoney(line.product.unit_price)}</p>}
                    </div>
                    <div className="col-span-2 flex justify-end pt-6 sm:col-span-1">
                      <Button type="button" variant="ghost" size="sm" disabled={fields.length === 1} onClick={() => remove(index)} aria-label="Remove line" icon={<Trash2 className="h-4 w-4" />} />
                    </div>
                  </div>
                );
              })}
              {formState.errors.items?.root?.message && <p className="text-sm text-red-600">{formState.errors.items.root.message}</p>}
              <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => append({ product_id: 0, quantity: 1 })}>
                Add product
              </Button>
            </div>
          </Card>

          <Card title="Notes">
            <div className="p-5">
              <Field label="Notes for the approver (optional)" error={formState.errors.notes?.message}>
                <Textarea rows={3} {...register("notes")} placeholder="Delivery terms, discounts agreed, etc." />
              </Field>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-6">
            <div className="space-y-4 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Items</span>
                <span>{lines.filter((l) => l.product).reduce((s, l) => s + l.qty, 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-4">
                <span className="font-medium">Order total</span>
                <span className="text-xl font-semibold">{formatMoney(total)}</span>
              </div>
              {threshold !== undefined && (
                <div className={`rounded-lg p-3 text-sm ${needsApproval ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
                  {needsApproval ? (
                    <p className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Above the {formatMoney(threshold)} limit. This order will wait for manager approval; stock is deducted once it's approved.
                    </p>
                  ) : (
                    <p>Within the {formatMoney(threshold)} limit. The order completes immediately and stock is deducted.</p>
                  )}
                </div>
              )}
              {stockProblems.length > 0 && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Some quantities exceed available stock.</p>
              )}
              <Button type="submit" className="w-full" loading={create.isPending} disabled={stockProblems.length > 0}>
                {needsApproval ? "Submit for approval" : "Place order"}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}
