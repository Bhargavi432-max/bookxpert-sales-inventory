import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { customersApi } from "../api/endpoints";
import type { Customer } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Pagination, Table, Td, Textarea, Th } from "../components/ui";
import { applyFieldErrors, getErrorMessage } from "../lib/errors";
import { useDebounced } from "../lib/useDebounced";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(150),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number"),
  address: z.string().max(500).optional(),
  gstin: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "GSTIN is 15 characters, starting with the state code")
    .optional(),
});
type FormValues = z.infer<typeof schema>;

function CustomerFormModal({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, setError } = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address ?? "", gstin: customer.gstin ?? "" }
      : { address: "", gstin: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body = { ...values, address: values.address?.trim() || null, gstin: values.gstin || null };
      return customer ? customersApi.update(customer.id, body) : customersApi.create(body);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(customer ? "Customer updated" : `${saved.name} added`);
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) toast.error(getErrorMessage(error));
    },
  });

  const submit = handleSubmit((v) => mutation.mutate(v));
  return (
    <Modal
      open
      title={customer ? `Edit ${customer.name}` : "Add customer"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={submit}>{customer ? "Save changes" : "Add customer"}</Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={submit} noValidate>
        <Field label="Name" error={formState.errors.name?.message} className="col-span-2">
          <Input invalid={!!formState.errors.name} {...register("name")} />
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          <Input type="email" invalid={!!formState.errors.email} {...register("email")} />
        </Field>
        <Field label="Phone" error={formState.errors.phone?.message}>
          <Input placeholder="+91 98765 43210" invalid={!!formState.errors.phone} {...register("phone")} />
        </Field>
        <Field label="GSTIN (optional)" error={formState.errors.gstin?.message} className="col-span-2">
          <Input placeholder="36AABCS1429B1Z5" invalid={!!formState.errors.gstin} {...register("gstin")} />
        </Field>
        <Field label="Address (optional)" error={formState.errors.address?.message} className="col-span-2">
          <Textarea rows={2} {...register("address")} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Customer | null>(null);
  const debouncedSearch = useDebounced(search);

  const query = useQuery({
    queryKey: ["customers", { page, search: debouncedSearch }],
    queryFn: () => customersApi.list({ page, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => customersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deactivated");
      setDeactivating(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Who you sell to."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add customer</Button>}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data!.items.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  <Th>GSTIN</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data!.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </Td>
                    <Td>{c.phone}</Td>
                    <Td className="font-mono text-xs">{c.gstin ?? "—"}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(c)}>Edit</Button>
                      {isManager && (
                        <Button variant="ghost" size="sm" icon={<UserX className="h-4 w-4" />} onClick={() => setDeactivating(c)}>Deactivate</Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={query.data!.page_size} total={query.data!.total} onChange={setPage} />
          </>
        )}
      </Card>
      {editing !== undefined && <CustomerFormModal customer={editing} onClose={() => setEditing(undefined)} />}
      <Modal
        open={deactivating !== null}
        title="Deactivate customer"
        onClose={() => setDeactivating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeactivating(null)}>Cancel</Button>
            <Button variant="danger" loading={deactivate.isPending} onClick={() => deactivate.mutate(deactivating!.id)}>Deactivate</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <b>{deactivating?.name}</b> will no longer appear when raising orders. Their order history is kept.
        </p>
      </Modal>
    </>
  );
}
