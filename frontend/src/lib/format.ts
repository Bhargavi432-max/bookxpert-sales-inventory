const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export const formatMoney = (value: number) => inr.format(value);
export const formatMoneyCompact = (value: number) => inrCompact.format(value);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const humanize = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
