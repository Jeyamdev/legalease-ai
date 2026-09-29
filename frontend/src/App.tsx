import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";

import { StaffLoginPage } from "./pages/StaffLoginPage";
import { SignupPage } from "./pages/admin/SignupPage";

import { DocumentationRequestsPage } from "./pages/admin/document_and_clerk/DocumentationRequestsPage";
import { DocumentationRequestDetailPage } from "./pages/admin/document_and_clerk/DocumentationRequestDetailPage";
import { ClerksPage } from "./pages/admin/document_and_clerk/ClerksPage";
import { DocumentationServicesPage } from "./pages/admin/document_and_clerk/DocumentationServicesPage";

import { CareersPage } from "./pages/admin/CareersPage";
import { ClientsPage } from "./pages/admin/ClientsPage";
import { LawyersPage } from "./pages/admin/LawyersPage";
import { AdminServiceRequestsPage } from "./pages/admin/ServiceRequestsAdminPage";

import { ClerkCasesPage } from "./pages/clerk/ClerkCasesPage";
import { LawyerDashboardPage } from "./pages/lawyer/LawyerDashboardPage";

import { CareersPublicPage } from "./pages/public/CareersPublicPage";

import {
  AdminRoute,
  ClerkRoute,
  LawyerRoute,
} from "./routes/ProtectedRoutes";

import { CustomerLoginPage } from "./pages/customer/CustomerLoginPage";
import { MyServiceRequestsPage } from "./pages/customer/MyServiceRequestsPage";
import { CreateServiceRequestPage } from "./pages/customer/CreateServiceRequestPage";
import { ServiceRequestDetailPage } from "./pages/customer/ServiceRequestDetailPage";

/* Lawyer Management - Admin only */
import { AdminLayout } from "./features/lawyers/components/Shared";
import LawyerListPage from "./features/lawyers/pages/LawyerListPage";
import LawyerEditorPage from "./features/lawyers/pages/LawyerEditorPage";
import LawyerDetailPage from "./features/lawyers/pages/LawyerDetailPage";
import RecommendationPage from "./features/lawyers/recommendations/RecommendationPage";
import CatalogPage from "./features/lawyers/pages/CatalogPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =========================================================
            PUBLIC
        ========================================================= */}

        <Route path="/" element={<LandingPage />} />

        <Route
          path="/careers"
          element={<CareersPublicPage />}
        />

        <Route
          path="/jobs"
          element={<CareersPublicPage />}
        />

        {/* =========================================================
            STAFF AUTHENTICATION
            Admin / Clerk / Lawyer all use the same login
        ========================================================= */}

        <Route
          path="/login"
          element={<StaffLoginPage />}
        />

        <Route
          path="/signup"
          element={<SignupPage />}
        />

        {/* Old staff login URLs */}
        <Route
          path="/staff/login"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/clerk/login"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/member1/login"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="/admin/login"
          element={<Navigate to="/login" replace />}
        />

        {/* =========================================================
            CLERK PORTAL
        ========================================================= */}

        <Route
          path="/clerk"
          element={<Navigate to="/clerk/cases" replace />}
        />

        <Route
          path="/clerk/cases"
          element={
            <ClerkRoute>
              <ClerkCasesPage />
            </ClerkRoute>
          }
        />

        {/* =========================================================
            LAWYER PORTAL
        ========================================================= */}

        <Route
          path="/lawyer"
          element={<Navigate to="/lawyer/dashboard" replace />}
        />

        <Route
          path="/lawyer/dashboard"
          element={
            <LawyerRoute>
              <LawyerDashboardPage />
            </LawyerRoute>
          }
        />

        {/* =========================================================
            ADMIN PORTAL
        ========================================================= */}

        <Route
          path="/admin"
          element={
            <Navigate
              to="/admin/documentation-requests"
              replace
            />
          }
        />

        <Route
          path="/admin/documentation-requests"
          element={
            <AdminRoute>
              <DocumentationRequestsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/documentation-requests/:id"
          element={
            <AdminRoute>
              <DocumentationRequestDetailPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/clerks"
          element={
            <AdminRoute>
              <ClerksPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/clients"
          element={
            <AdminRoute>
              <ClientsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/documentation-services"
          element={
            <AdminRoute>
              <DocumentationServicesPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/careers"
          element={
            <AdminRoute>
              <CareersPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/service-requests"
          element={
            <AdminRoute>
              <AdminServiceRequestsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/lawyers"
          element={
            <AdminRoute>
              <LawyersPage />
            </AdminRoute>
          }
        />

        {/* =========================================================
            ADMIN LAWYER MANAGEMENT
        ========================================================= */}

        <Route
          path="/admin/lawyer-management"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            index
            element={<LawyerListPage />}
          />

          <Route
            path="new"
            element={<LawyerEditorPage />}
          />

          <Route
            path=":id"
            element={<LawyerDetailPage />}
          />

          <Route
            path=":id/edit"
            element={<LawyerEditorPage />}
          />

          <Route
            path="specializations"
            element={
              <CatalogPage
                key="specializations"
                kind="specializations"
              />
            }
          />

          <Route
            path="legal-services"
            element={
              <CatalogPage
                key="legal-services"
                kind="legal-services"
              />
            }
          />

          <Route
            path="recommendation-test"
            element={<RecommendationPage />}
          />
        </Route>

        {/* =========================================================
            CUSTOMER
        ========================================================= */}

        <Route
          path="/customer/login"
          element={<CustomerLoginPage />}
        />

        <Route
          path="/my-requests"
          element={<MyServiceRequestsPage />}
        />

        <Route
          path="/my-requests/new"
          element={<CreateServiceRequestPage />}
        />

        <Route
          path="/my-requests/:id"
          element={<ServiceRequestDetailPage />}
        />

        {/* =========================================================
            CATCH ALL
        ========================================================= */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;