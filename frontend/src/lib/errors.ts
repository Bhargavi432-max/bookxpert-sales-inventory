import { isAxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ApiErrorBody } from "../api/types";

export function getErrorMessage(error: unknown): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return "Cannot reach the server. Check your connection and try again.";
    return error.response.data?.error?.message ?? `Request failed (${error.response.status})`;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

export function getErrorCode(error: unknown): string | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error?.code : undefined;
}

/** Maps server-side field errors onto react-hook-form fields. Returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!isAxiosError<ApiErrorBody>(error)) return false;
  const details = error.response?.data?.error?.details;
  if (!Array.isArray(details)) return false;
  let applied = false;
  for (const detail of details as { field?: string; message?: string }[]) {
    if (detail.field && detail.message) {
      setError(detail.field as Path<T>, { type: "server", message: detail.message });
      applied = true;
    }
  }
  return applied;
}
