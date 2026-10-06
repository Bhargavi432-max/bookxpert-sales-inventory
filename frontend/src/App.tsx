import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth, RequireManager } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import ApprovalsPage from "./pages/ApprovalsPage";
import CustomersPage from "./pages/CustomersPage";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import LoginPage from "./pages/LoginPage";
import NewOrderPage from "./pages/NewOrderPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route element={<RequireManager />}>
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
