from app.models import Product


def _create_order(client, headers, seed, product_key, quantity):
    payload = {"customer_id": seed["customer"].id, "items": [{"product_id": seed[product_key].id, "quantity": quantity}]}
    return client.post("/api/v1/orders", json=payload, headers=headers)


def _stock(db, product) -> int:
    db.expire_all()
    return db.get(Product, product.id).stock_quantity


def test_order_under_threshold_completes_and_deducts_stock(client, db, seed, sales_headers, sent_emails):
    response = _create_order(client, sales_headers, seed, "cheap", 3)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert body["total_amount"] == 3000.0
    assert body["approval"] is None
    assert _stock(db, seed["cheap"]) == 47
    assert sent_emails == []


def test_order_above_threshold_waits_for_approval_and_emails_managers(client, db, seed, sales_headers, sent_emails):
    response = _create_order(client, sales_headers, seed, "pricey", 1)

    body = response.json()
    assert body["status"] == "PENDING_APPROVAL"
    assert body["approval"]["status"] == "PENDING"
    assert _stock(db, seed["pricey"]) == 5
    assert len(sent_emails) == 1
    assert set(sent_emails[0].to) == {"manager@test.com", "manager2@test.com"}


def test_insufficient_stock_is_rejected_without_side_effects(client, db, seed, sales_headers):
    response = _create_order(client, sales_headers, seed, "cheap", 51)

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "INSUFFICIENT_STOCK"
    assert error["details"][0]["available"] == 50
    assert _stock(db, seed["cheap"]) == 50


def test_validation_errors_are_reported_per_field(client, sales_headers, seed):
    response = client.post("/api/v1/orders", json={"customer_id": seed["customer"].id, "items": [{"product_id": 1, "quantity": 0}]}, headers=sales_headers)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "items.0.quantity"


def test_manager_approval_completes_order_and_notifies_creator(client, db, seed, sales_headers, manager_headers, sent_emails):
    order_id = _create_order(client, sales_headers, seed, "pricey", 2).json()["id"]
    sent_emails.clear()

    response = client.post(f"/api/v1/orders/{order_id}/approve", json={"comment": "Fine"}, headers=manager_headers)

    body = response.json()
    assert body["status"] == "COMPLETED"
    assert body["approval"]["status"] == "APPROVED"
    assert body["approval"]["decided_by"]["email"] == "manager@test.com"
    assert _stock(db, seed["pricey"]) == 3
    assert sent_emails[0].to == ("sales@test.com",)
    assert "approved" in sent_emails[0].subject


def test_rejection_requires_reason_and_keeps_stock(client, db, seed, sales_headers, manager_headers, sent_emails):
    order_id = _create_order(client, sales_headers, seed, "pricey", 1).json()["id"]

    assert client.post(f"/api/v1/orders/{order_id}/reject", json={}, headers=manager_headers).status_code == 422
    response = client.post(f"/api/v1/orders/{order_id}/reject", json={"comment": "Too expensive"}, headers=manager_headers)

    assert response.json()["status"] == "REJECTED"
    assert _stock(db, seed["pricey"]) == 5
    assert "rejected" in sent_emails[-1].subject


def test_order_cannot_be_decided_twice(client, seed, sales_headers, manager_headers):
    order_id = _create_order(client, sales_headers, seed, "pricey", 1).json()["id"]
    client.post(f"/api/v1/orders/{order_id}/approve", json={}, headers=manager_headers)

    response = client.post(f"/api/v1/orders/{order_id}/reject", json={"comment": "Changed my mind"}, headers=manager_headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_ORDER_STATE"


def test_sales_user_cannot_approve(client, seed, sales_headers):
    order_id = _create_order(client, sales_headers, seed, "pricey", 1).json()["id"]
    assert client.post(f"/api/v1/orders/{order_id}/approve", json={}, headers=sales_headers).status_code == 403


def test_manager_cannot_approve_own_order(client, seed, manager_headers, manager2_headers):
    order_id = _create_order(client, manager_headers, seed, "pricey", 1).json()["id"]

    assert client.post(f"/api/v1/orders/{order_id}/approve", json={}, headers=manager_headers).status_code == 403
    assert client.post(f"/api/v1/orders/{order_id}/approve", json={}, headers=manager2_headers).status_code == 200


def test_approval_rechecks_stock(client, db, seed, sales_headers, manager_headers):
    order_id = _create_order(client, sales_headers, seed, "pricey", 4).json()["id"]
    # Stock drops after the order was raised (e.g. damaged goods written off).
    client.post(
        f"/api/v1/products/{seed['pricey'].id}/stock-adjustments",
        json={"txn_type": "ADJUSTMENT", "quantity_change": -3, "note": "Damaged in transit"},
        headers=manager_headers,
    )

    response = client.post(f"/api/v1/orders/{order_id}/approve", json={}, headers=manager_headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INSUFFICIENT_STOCK"
    assert _stock(db, seed["pricey"]) == 2


def test_creator_can_cancel_pending_order(client, seed, sales_headers):
    order_id = _create_order(client, sales_headers, seed, "pricey", 1).json()["id"]
    response = client.post(f"/api/v1/orders/{order_id}/cancel", json={}, headers=sales_headers)
    assert response.json()["status"] == "CANCELLED"


def test_threshold_change_applies_to_new_orders(client, seed, sales_headers, manager_headers):
    client.put("/api/v1/settings/approval-threshold", json={"approval_threshold": 1000}, headers=manager_headers)
    response = _create_order(client, sales_headers, seed, "cheap", 2)
    assert response.json()["status"] == "PENDING_APPROVAL"
