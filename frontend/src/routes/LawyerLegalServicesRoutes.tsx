import { Navigate, Route } from "react-router-dom";
import { LawyersPage } from "../pages/admin/LawyersPage";
import { LawyerLegalServicesLayout } from "../pages/admin/LawyerLegalServicesLayout";
import { SpecializationsPage } from "../pages/admin/SpecializationsPage";
import { LegalServicesPage } from "../pages/admin/LegalServicesPage";
import { RecommendationsPage } from "../pages/admin/RecommendationsPage";
import { AdminRoute } from "./ProtectedRoutes";

export const lawyerLegalServicesRoutes = <>
  <Route path="/admin/lawyers" element={<AdminRoute><Navigate to="/admin/lawyer-services/lawyers" replace /></AdminRoute>} />
  <Route path="/admin/lawyer-services" element={<AdminRoute><LawyerLegalServicesLayout /></AdminRoute>}>
    <Route index element={<Navigate to="lawyers" replace />} />
    <Route path="lawyers" element={<LawyersPage />} />
    <Route path="specializations" element={<SpecializationsPage />} />
    <Route path="legal-services" element={<LegalServicesPage />} />
    <Route path="recommendations" element={<RecommendationsPage />} />
  </Route>
</>;
