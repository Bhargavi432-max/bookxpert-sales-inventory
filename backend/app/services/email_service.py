"""Outgoing email. Messages are built inside the request (while ORM data is loaded)
and sent afterwards by a FastAPI background task, so SMTP latency or failure never
blocks or rolls back the business transaction."""
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from html import escape

from app.core.config import settings
from app.models import SalesOrder, User

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutgoingEmail:
    to: tuple[str, ...]
    subject: str
    html: str
    text: str


def send_email(email: OutgoingEmail) -> None:
    if not settings.smtp_enabled:
        logger.info("SMTP disabled; skipped email %r to %s", email.subject, ", ".join(email.to))
        return
    message = EmailMessage()
    message["Subject"] = email.subject
    message["From"] = settings.smtp_from
    message["To"] = ", ".join(email.to)
    message.set_content(email.text)
    message.add_alternative(email.html, subtype="html")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        logger.info("Sent email %r to %s", email.subject, ", ".join(email.to))
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send email %r to %s", email.subject, ", ".join(email.to))


def _money(amount) -> str:
    return f"₹{amount:,.2f}"


def _order_link(order: SalesOrder) -> str:
    return f"{settings.frontend_url}/orders/{order.id}"


def _items_html(order: SalesOrder) -> str:
    cell = "padding:8px;border-bottom:1px solid #e5e7eb;"
    rows = "".join(
        f"<tr><td style='{cell}'>{escape(item.product.name)}<br><small style='color:#6b7280'>{escape(item.product.sku)}</small></td>"
        f"<td style='{cell}text-align:right'>{item.quantity}</td>"
        f"<td style='{cell}text-align:right'>{_money(item.unit_price)}</td>"
        f"<td style='{cell}text-align:right'>{_money(item.line_total)}</td></tr>"
        for item in order.items
    )
    head = "padding:8px;background:#f3f4f6;text-align:left;font-size:12px;color:#374151;"
    return (
        "<table style='width:100%;border-collapse:collapse;font-size:14px;margin:16px 0'>"
        f"<tr><th style='{head}'>Product</th><th style='{head}text-align:right'>Qty</th>"
        f"<th style='{head}text-align:right'>Unit price</th><th style='{head}text-align:right'>Total</th></tr>"
        f"{rows}<tr><td colspan='3' style='padding:8px;text-align:right;font-weight:bold'>Order total</td>"
        f"<td style='padding:8px;text-align:right;font-weight:bold'>{_money(order.total_amount)}</td></tr></table>"
    )


def _layout(heading: str, accent: str, body: str, order: SalesOrder, button_label: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<div style="background:{accent};color:#fff;padding:16px 24px;font-size:18px;font-weight:bold">{escape(heading)}</div>
<div style="padding:24px">{body}{_items_html(order)}
<a href="{_order_link(order)}" style="display:inline-block;background:{accent};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">{escape(button_label)}</a>
</div><div style="padding:12px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">{escape(settings.app_name)} · automated notification</div>
</div></body></html>"""


def build_approval_request_email(order: SalesOrder, managers: list[User]) -> OutgoingEmail:
    threshold = order.approval.threshold_amount
    body = (
        f"<p>A sales order needs your approval because its total of <b>{_money(order.total_amount)}</b> "
        f"is above the approval limit of {_money(threshold)}.</p>"
        f"<p><b>Order:</b> {escape(order.order_number)}<br><b>Customer:</b> {escape(order.customer.name)}<br>"
        f"<b>Raised by:</b> {escape(order.created_by.name)} ({escape(order.created_by.email)})</p>"
        + (f"<p><b>Notes:</b> {escape(order.notes)}</p>" if order.notes else "")
    )
    text = (
        f"Order {order.order_number} for {order.customer.name} totals {_money(order.total_amount)}, "
        f"above the approval limit of {_money(threshold)}.\nRaised by {order.created_by.name}.\n"
        f"Review it here: {_order_link(order)}"
    )
    return OutgoingEmail(
        to=tuple(m.email for m in managers),
        subject=f"Approval required: {order.order_number} ({_money(order.total_amount)})",
        html=_layout("Order approval required", "#d97706", body, order, "Review order"),
        text=text,
    )


def build_decision_email(order: SalesOrder, approved: bool, manager: User, comment: str | None) -> OutgoingEmail:
    decision = "approved" if approved else "rejected"
    outcome = (
        "Stock has been deducted and the order is now <b>completed</b>."
        if approved
        else "No stock was deducted. You can raise a revised order if needed."
    )
    body = (
        f"<p>Hi {escape(order.created_by.name)},</p>"
        f"<p>Your order <b>{escape(order.order_number)}</b> for {escape(order.customer.name)} "
        f"was <b>{decision}</b> by {escape(manager.name)}.</p><p>{outcome}</p>"
        + (f"<p><b>Manager's comment:</b> {escape(comment)}</p>" if comment else "")
    )
    text = (
        f"Your order {order.order_number} for {order.customer.name} was {decision} by {manager.name}."
        + (f"\nComment: {comment}" if comment else "")
        + f"\nView it here: {_order_link(order)}"
    )
    return OutgoingEmail(
        to=(order.created_by.email,),
        subject=f"Order {order.order_number} {decision}",
        html=_layout(f"Order {decision}", "#059669" if approved else "#dc2626", body, order, "View order"),
        text=text,
    )
