import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../auth/AuthContext";
import { Button, Field, Input } from "../components/ui";
import { getErrorMessage } from "../lib/errors";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "Manager", email: "manager@bookxpert.com", password: "Manager@123" },
  { label: "Manager 2", email: "finance.manager@bookxpert.com", password: "Manager@123" },
  { label: "Sales", email: "sales@bookxpert.com", password: "Sales@123" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 font-bold">BX</div>
          <span className="text-lg font-semibold">BookXpert</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Sales & Inventory Management</h1>
          <p className="mt-3 max-w-md text-slate-300">
            Raise sales orders, keep stock accurate, and route high-value orders to a manager for approval.
          </p>
        </div>
        <p className="text-sm text-slate-500">Web Developer assignment</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your work account to continue.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <Field label="Email" error={formState.errors.email?.message}>
              <Input type="email" autoComplete="email" invalid={!!formState.errors.email} {...register("email")} />
            </Field>
            <Field label="Password" error={formState.errors.password?.message}>
              <Input type="password" autoComplete="current-password" invalid={!!formState.errors.password} {...register("password")} />
            </Field>
            {serverError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
            <Button type="submit" className="w-full" loading={formState.isSubmitting}>
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Demo accounts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setValue("email", account.email);
                    setValue("password", account.password);
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
