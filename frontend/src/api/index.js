import axios from "axios";

const BASE_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("projetenne_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("projetenne_token");
      localStorage.removeItem("projetenne_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
};

export const projectsAPI = {
  list: () => api.get("/projects"),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post("/projects", data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
};

export const teamsAPI = {
  list: () => api.get("/teams"),
  get: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post("/teams", data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  capacityHeatmap: (months = 6) => api.get(`/teams/capacity-heatmap?months=${months}`),
  capacityAlerts: () => api.get("/teams/capacity-alerts"),
};

export const workAllocationsAPI = {
  list: (projectId) => api.get(`/projects/${projectId}/work-allocations`),
  create: (data) => api.post("/work-allocations", data),
  update: (id, data) => api.put(`/work-allocations/${id}`, data),
  delete: (id) => api.delete(`/work-allocations/${id}`),
  teamConsumption: (projectId) => api.get(`/projects/${projectId}/team-consumption`),
  raf: (projectId) => api.get(`/projects/${projectId}/raf`),
};

export const resourcesAPI = {
  list: () => api.get("/resources"),
  create: (data) => api.post("/resources", data),
  update: (id, data) => api.put(`/resources/${id}`, data),
  delete: (id) => api.delete(`/resources/${id}`),
};

export const allocationsAPI = {
  list: (projectId) => api.get(`/allocations${projectId ? `?project_id=${projectId}` : ""}`),
};

export const milestonesAPI = {
  list: (projectId) => api.get(`/milestones${projectId ? `?project_id=${projectId}` : ""}`),
};

export const tasksAPI = {
  list: (projectId) => api.get(`/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  create: (data) => api.post("/tasks", data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

export const programsAPI = {
  list: () => api.get("/programs"),
  get: (id) => api.get(`/programs/${id}`),
  create: (data) => api.post("/programs", data),
  update: (id, data) => api.put(`/programs/${id}`, data),
  delete: (id) => api.delete(`/programs/${id}`),
};

export const governanceAPI = {
  list: () => api.get("/governance"),
};

export const risksAPI = {
  list: (projectId) => api.get(`/risks${projectId ? `?project_id=${projectId}` : ""}`),
  create: (data) => api.post("/risks", data),
  update: (id, data) => api.put(`/risks/${id}`, data),
  delete: (id) => api.delete(`/risks/${id}`),
};

export const decisionsAPI = {
  list: (projectId, governanceId) => {
    const params = new URLSearchParams();
    if (projectId) params.append("project_id", projectId);
    if (governanceId) params.append("governance_id", governanceId);
    const qs = params.toString();
    return api.get(`/decisions${qs ? `?${qs}` : ""}`);
  },
  create: (data) => api.post("/decisions", data),
  update: (id, data) => api.put(`/decisions/${id}`, data),
  delete: (id) => api.delete(`/decisions/${id}`),
};

export const exportAPI = {
  copil: (data) => api.post("/export/copil", data, { responseType: "arraybuffer" }),
};

export const dashboardAPI = {
  summary: () => api.get("/dashboard/summary"),
  topRisks: () => api.get("/dashboard/top-risks"),
  heatmapRisks: () => api.get("/dashboard/heatmap-risks"),
};

export const timesheetsAPI = {
  getGrid:           (resourceId, weekStart) => api.get(`/timesheets/grid?resource_id=${resourceId}&week_start=${weekStart}`),
  upsertEntry:       (data)  => api.put("/timesheets/entry", data),
  submitWeek:        (data)  => api.post("/timesheets/submit-week", data),
  getPendingCount:   ()      => api.get("/timesheets/pending-count"),
  getValidation:     (week)  => api.get(`/timesheets/validation${week ? `?week_start=${week}` : ""}`),
  validateTimesheets:(data)  => api.post("/timesheets/validate", data),
  rejectTimesheets:  (data)  => api.post("/timesheets/reject", data),
  getReport:         (dim, start, end) => api.get(`/timesheets/report?dimension=${dim}&start=${start}&end=${end}`),
  getReportCsv:      (dim, start, end) => api.get(`/timesheets/report/csv?dimension=${dim}&start=${start}&end=${end}`, { responseType: "text" }),
};

export default api;
