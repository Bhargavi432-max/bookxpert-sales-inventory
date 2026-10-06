import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";

import { productsApi } from "../api/endpoints";
import type { Product } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Pagination, Select, Table, Td, Textarea, Th } from "../components/ui";
import { applyFieldErrors, getErrorMessage } from "../lib/errors";
import { formatMoney } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";

const productSchema = z.object({
  sku: z.string().trim().min(2, "At least 2 characters").max(50).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  name: z.string().trim().min(2, "At least 2 characters").max(200),
  description: z.string().max(1000).optional(),
  unit_price: z.number({ error: "Enter a price" }).positive("Must be more than 0").max(9_999_999_999, "Too large"),
  reorder_level: z.number({ error: "Enter a number" }).int().min(0, "Cannot be negative"),
  initial_stock: z.number({ error: "Enter a number" }).int().min(0, "Cannot be negative"),
});
type ProductForm = z.infer<typeof productSchema>;

function ProductFormModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = product !== null;
  const { register, handleSubmit, formState, setError } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? { sku: product.sku, name: product.name, description: product.description ?? "", unit_price: product.unit_price, reorder_level: product.reorder_level, initial_stock: 0 }
      : { reorder_level: 10, initial_stock: 0, description: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ProductForm) => {
      const body = { name: values.name, description: values.description?.trim() || null, unit_price: values.unit_price, reorder_level: values.reorder_level };
      return editing ? productsApi.update(product.id, body) : productsApi.create({ ...body, sku: values.sku, initial_stock: values.initial_stock });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Product updated" : `${saved.name} added`);
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  return (
    <Modal
      open
      title={editing ? `Edit ${product.name}` : "Add product"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
            {editing ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field label="SKU" error={formState.errors.sku?.message} hint={editing ? "SKU can't be changed" : undefined}>
          <Input disabled={editing} invalid={!!formState.errors.sku} {...register("sku")} />
        </Field>
        <Field label="Unit price (₹)" error={formState.errors.unit_price?.message}>
          <Input type="number" step="0.01" invalid={!!formState.errors.unit_price} {...register("unit_price", { valueAsNumber: true })} />
        </Field>
        <Field label="Name" error={formState.errors.name?.message} className="col-span-2">
          <Input invalid={!!formState.errors.name} {...register("name")} />
        </Field>
        <Field label="Description" error={formState.errors.description?.message} className="col-span-2">
          <Textarea rows={2} {...register("description")} />
        </Field>
        <Field label="Reorder level" error={formState.errors.reorder_level?.message} hint="Flagged as low stock at or below this">
          <Input type="number" invalid={!!formState.errors.reorder_level} {...register("reorder_level", { valueAsNumber: true })} />
        </Field>
        {!editing && (
          <Field label="Opening stock" error={formState.errors.initial_stock?.message}>
            <Input type="number" invalid={!!formState.errors.initial_stock} {...register("initial_stock", { valueAsNumber: true })} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

const adjustSchema = z.object({
  txn_type: z.enum(["RESTOCK", "ADJUSTMENT"]),
  quantity_change: z.number({ error: "Enter a quantity" }).int("Whole numbers only").refine((v) => v !== 0, "Cannot be zero"),
  note: z.string().trim().min(3, "Add a short reason").max(255),
});
type AdjustForm = z.infer<typeof adjustSchema>;

function StockAdjustModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, setError, watch } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { txn_type: "RESTOCK", note: "" },
  });
  const change = watch("quantity_change");
  const preview = Number.isFinite(change) ? product.stock_quantity + change : product.stock_quantity;

  const mutation = useMutation({
    mutationFn: (values: AdjustForm) => productsApi.adjustStock(product.id, values),
    onSuccess: (updated) => {
      for (const key of ["products", "dashboard", "inventory"]) queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(`${updated.name}: stock is now ${updated.stock_quantity}`);
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  return (
    <Modal
      open
      title={`Adjust stock – ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>Save adjustment</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Field label="Type">
          <Select {...register("txn_type")}>
            <option value="RESTOCK">Restock (goods received)</option>
            <option value="ADJUSTMENT">Adjustment (count correction, damage…)</option>
          </Select>
        </Field>
        <Field label="Quantity change" error={formState.errors.quantity_change?.message} hint="Use a negative number to remove stock (adjustments only)">
          <Input type="number" invalid={!!formState.errors.quantity_change} {...register("quantity_change", { valueAsNumber: true })} />
        </Field>
        <Field label="Reason" error={formState.errors.note?.message}>
          <Input placeholder="e.g. PO-1182 received from Dell" invalid={!!formState.errors.note} {...register("note")} />
        </Field>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          Stock: <b>{product.stock_quantity}</b> → <b className={preview < 0 ? "text-red-600" : ""}>{preview}</b>
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const { isManager } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(params.get("low_stock") === "1");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const debouncedSearch = useDebounced(search);

  const query = useQuery({
    queryKey: ["products", { page, search: debouncedSearch, lowStock }],
    queryFn: () => productsApi.list({ page, search: debouncedSearch, low_stock: lowStock || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Catalogue, prices and stock on hand."
        actions={isManager && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add product</Button>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search name or SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} />
            Low stock only
          </label>
        </div>
        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data!.items.length === 0 ? (
          <EmptyState title="No products found" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">In stock</Th>
                  <Th>Status</Th>
                  {isManager && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data!.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.sku}</p>
                    </Td>
                    <Td className="text-right">{formatMoney(p.unit_price)}</Td>
                    <Td className="text-right">
                      <span className="font-medium">{p.stock_quantity}</span>
                      <p className="text-xs text-slate-500">reorder at {p.reorder_level}</p>
                    </Td>
                    <Td>
                      {p.stock_quantity === 0 ? <Badge tone="red">Out of stock</Badge> : p.is_low_stock ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">In stock</Badge>}
                    </Td>
                    {isManager && (
                      <Td className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" icon={<PackagePlus className="h-4 w-4" />} onClick={() => setAdjusting(p)}>Stock</Button>
                        <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(p)}>Edit</Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={query.data!.page_size} total={query.data!.total} onChange={setPage} />
          </>
        )}
      </Card>
      {editing !== undefined && <ProductFormModal product={editing} onClose={() => setEditing(undefined)} />}
      {adjusting && <StockAdjustModal product={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  );
}
