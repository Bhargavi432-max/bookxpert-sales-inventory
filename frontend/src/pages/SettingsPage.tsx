import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { settingsApi } from "../api/endpoints";
import { Button, Card, Field, Input, LoadingBlock, PageHeader } from "../components/ui";
import { getErrorMessage } from "../lib/errors";
import { formatMoney } from "../lib/format";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setValue(String(query.data.approval_threshold));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: settingsApi.updateThreshold,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Approval limit set to ${formatMoney(data.approval_threshold)}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    mutation.mutate(Math.round(amount * 100) / 100);
  };

  if (query.isLoading) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Business rules for the approval workflow." />
      <Card title="Order approval limit" className="max-w-xl">
        <form onSubmit={save} className="space-y-4 p-5" noValidate>
          <p className="text-sm text-slate-600">
            Orders with a total <b>above</b> this amount are held for manager approval and managers are notified by email. Orders at or below it complete immediately.
            Changing it only affects new orders.
          </p>
          <Field label="Approval limit (₹)" error={error ?? undefined}>
            <Input type="number" min={1} step="0.01" value={value} invalid={!!error} onChange={(e) => { setValue(e.target.value); setError(null); }} />
          </Field>
          <Button type="submit" loading={mutation.isPending}>Save</Button>
        </form>
      </Card>
    </>
  );
}
