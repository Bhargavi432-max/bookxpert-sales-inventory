import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { usersApi } from "../api/endpoints";
import type { User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, ErrorState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Table, Td, Th } from "../components/ui";
import { applyFieldErrors, getErrorMessage } from "../lib/errors";
import { formatDate } from "../lib/format";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(100),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  role: z.enum(["SALES", "MANAGER"]),
});
type FormValues = z.infer<typeof schema>;

function NewUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState, setError } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: "SALES" } });
  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`${user.name} can now sign in`);
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
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={submit}>Create user</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Name" error={formState.errors.name?.message}><Input invalid={!!formState.errors.name} {...register("name")} /></Field>
        <Field label="Email" error={formState.errors.email?.message}><Input type="email" invalid={!!formState.errors.email} {...register("email")} /></Field>
        <Field label="Temporary password" error={formState.errors.password?.message}><Input type="password" autoComplete="new-password" invalid={!!formState.errors.password} {...register("password")} /></Field>
        <Field label="Role">
          <Select {...register("role")}>
            <option value="SALES">Sales – raises orders</option>
            <option value="MANAGER">Manager – approves orders, manages stock</option>
          </Select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const query = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list({ page: 1 }) });
  const toggle = useMutation({
    mutationFn: (user: User) => usersApi.update(user.id, { is_active: !user.is_active }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`${user.name} ${user.is_active ? "reactivated" : "deactivated"}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in, and what they can do." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add user</Button>} />
      <Card>
        {query.isLoading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Since</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data!.items.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </Td>
                  <Td><Badge tone={u.role === "MANAGER" ? "violet" : "blue"}>{u.role === "MANAGER" ? "Manager" : "Sales"}</Badge></Td>
                  <Td className="text-slate-600">{formatDate(u.created_at)}</Td>
                  <Td>{u.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                  <Td className="text-right">
                    {u.id !== me?.id && (
                      <Button variant="ghost" size="sm" loading={toggle.isPending && toggle.variables?.id === u.id} onClick={() => toggle.mutate(u)}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {adding && <NewUserModal onClose={() => setAdding(false)} />}
    </>
  );
}
