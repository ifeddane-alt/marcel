import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantConfigProvider } from "@/contexts/TenantConfigContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import Programs from "@/pages/Programs";
import ProgramDetail from "@/pages/ProgramDetail";
import Portfolio from "@/pages/Portfolio";
import ProjectDetail from "@/pages/ProjectDetail";
import Resources from "@/pages/Resources";
import ResourceDetail from "@/pages/ResourceDetail";
import Governance from "@/pages/Governance";
import Objectives from "@/pages/Objectives";
import Account from "@/pages/Account";
import Conformite from "@/pages/Conformite";
import Import from "@/pages/Import";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Roadmap from "@/pages/Roadmap";
import Timesheets from "@/pages/Timesheets";
import Demands from "@/pages/Demands";
import AdminProfiles from "@/pages/AdminProfiles";
import AdminUsers from "@/pages/AdminUsers";
import AdminConfig from "@/pages/AdminConfig";
import Vendors from "@/pages/Vendors";
import TrainsSafe from "@/pages/TrainsSafe";
import Scope from "@/pages/Scope";
import Arbitrage from "@/pages/Arbitrage";
import Connectors from "@/pages/Connectors";
import Recommandations from "@/pages/Recommandations";
import MesAlertes from "@/pages/MesAlertes";
import AgentAnalytics from "@/pages/AgentAnalytics";
import Budget from "@/pages/Budget";
import AdminPowerBI from "@/pages/AdminPowerBI";
import AdminTemplates from "@/pages/AdminTemplates";
import AdminMonitoring from "@/pages/AdminMonitoring";
import AdminAudit from "@/pages/AdminAudit";
import Applications from "@/pages/Applications";
import ApplicationDetail from "@/pages/ApplicationDetail";
import Run from "@/pages/Run";
import Security from "@/pages/Security";
import Architecture from "@/pages/Architecture";
import Pilotage from "@/pages/Pilotage";
import ParticipatoryBudgeting from "@/pages/ParticipatoryBudgeting";
import MyValidations from "@/pages/MyValidations";
import Presentation from "@/pages/Presentation";
import "@/App.css";

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  const perms = user?.permissions || [];
  const hasAdmin = perms.includes("*") || perms.some((p) => p.startsWith("admin."));
  if (!hasAdmin) return <Navigate to="/home" replace />;
  return children;
}

/**
 * Route /dashboard : redirige automatiquement les profils sans dashboard.view
 * (ex: USER/Contributeur) vers /timesheets.
 */
function DashboardGuard() {
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const hasDashboard = perms.includes("*") || perms.includes("dashboard.view");
  if (!hasDashboard) return <Navigate to="/timesheets" replace />;
  return <Dashboard />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/home" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="dashboard" element={<DashboardGuard />} />
        <Route path="cxo" element={<Navigate to="/dashboard" replace />} />
        <Route path="programmes" element={<Programs />} />
        <Route path="programmes/:id" element={<ProgramDetail />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="budget" element={<Budget />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="resources" element={<Resources />} />
        <Route path="resources/:resourceId" element={<ResourceDetail />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="scope" element={<Scope />} />
        <Route path="arbitrage" element={<Arbitrage />} />
        <Route path="admin/connectors" element={<Connectors />} />
        <Route path="agent/recommandations" element={<Recommandations />} />
        <Route path="agent/alertes" element={<MesAlertes />} />
        <Route path="admin/agent-analytics" element={<AdminRoute><AgentAnalytics /></AdminRoute>} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="governance" element={<Governance />} />
        <Route path="objectifs" element={<Objectives />} />
        <Route path="account" element={<Account />} />
        <Route path="conformite" element={<Conformite />} />
        <Route path="demands" element={<Demands />} />
        <Route path="admin/profiles" element={<AdminRoute><AdminProfiles /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="admin/config" element={<AdminRoute><AdminConfig /></AdminRoute>} />
        <Route path="admin/powerbi" element={<AdminRoute><AdminPowerBI /></AdminRoute>} />
        <Route path="admin/templates" element={<AdminRoute><AdminTemplates /></AdminRoute>} />
        <Route path="admin/monitoring" element={<AdminRoute><AdminMonitoring /></AdminRoute>} />
        <Route path="admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
        <Route path="applications" element={<Applications />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="run" element={<Run />} />
        <Route path="securite" element={<Security />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="pilotage" element={<Pilotage />} />
        <Route path="pb" element={<ParticipatoryBudgeting />} />
        <Route path="validations" element={<MyValidations />} />
        <Route path="presentation" element={<Presentation />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="safe/trains" element={<TrainsSafe />} />
        <Route path="safe/trains/:trainId" element={<TrainsSafe />} />
        <Route path="import" element={<Import />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <TenantConfigProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TenantConfigProvider>
    </AuthProvider>
  );
}

export default App;
