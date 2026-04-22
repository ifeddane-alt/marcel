import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Programs from "@/pages/Programs";
import ProgramDetail from "@/pages/ProgramDetail";
import Portfolio from "@/pages/Portfolio";
import ProjectDetail from "@/pages/ProjectDetail";
import Resources from "@/pages/Resources";
import Governance from "@/pages/Governance";
import Conformite from "@/pages/Conformite";
import Import from "@/pages/Import";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Roadmap from "@/pages/Roadmap";
import Timesheets from "@/pages/Timesheets";
import Demands from "@/pages/Demands";
import AdminProfiles from "@/pages/AdminProfiles";
import AdminUsers from "@/pages/AdminUsers";
import "@/App.css";

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="programmes" element={<Programs />} />
        <Route path="programmes/:id" element={<ProgramDetail />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="resources" element={<Resources />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="governance" element={<Governance />} />
        <Route path="conformite" element={<Conformite />} />
        <Route path="demands" element={<Demands />} />
        <Route path="admin/profiles" element={<AdminProfiles />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="import" element={<Import />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
