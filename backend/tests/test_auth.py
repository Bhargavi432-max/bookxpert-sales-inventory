def test_login_rejects_wrong_password(client, seed):
    response = client.post("/api/v1/auth/login", json={"email": "sales@test.com", "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_protected_route_requires_token(client, seed):
    assert client.get("/api/v1/products").status_code == 401


def test_me_returns_current_user(client, sales_headers):
    response = client.get("/api/v1/auth/me", headers=sales_headers)
    assert response.json()["role"] == "SALES"


def test_sales_user_cannot_create_products(client, sales_headers):
    payload = {"sku": "NEW-1", "name": "New thing", "unit_price": 10}
    assert client.post("/api/v1/products", json=payload, headers=sales_headers).status_code == 403
