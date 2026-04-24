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
  list:           (projectId) => api.get(`/milestones${projectId ? `?project_id=${projectId}` : ""}`),
  create:         (data)      => api.post("/milestones", data),
  update:         (id, data)  => api.put(`/milestones/${id}`, data),
  delete:         (id)        => api.delete(`/milestones/${id}`),
  regulatory:     (params)    => api.get("/milestones/regulatory", { params }),
  regulatoryKpis: ()          => api.get("/milestones/regulatory/kpis"),
  regulatoryCsv:  (params)    => api.get("/milestones/regulatory/csv", { params, responseType: "text" }),
};

export const projectDependenciesAPI = {
  list: (projectId) => api.get(`/project-dependencies?project_id=${projectId}`),
  listAll: () => api.get("/project-dependencies/all"),
  create: (data) => api.post("/project-dependencies", data),
  update: (id, data) => api.put(`/project-dependencies/${id}`, data),
  delete: (id) => api.delete(`/project-dependencies/${id}`),
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
  getValidation:     (view, week) => api.get(`/timesheets/validation?view=${view}${week ? `&week_start=${week}` : ""}`),
  validateTimesheets:(data)  => api.post("/timesheets/validate", data),
  rejectTimesheets:  (data)  => api.post("/timesheets/reject", data),
  getReport:         (dim, start, end) => api.get(`/timesheets/report?dimension=${dim}&start=${start}&end=${end}`),
  getReportCsv:      (dim, start, end) => api.get(`/timesheets/report/csv?dimension=${dim}&start=${start}&end=${end}`, { responseType: "text" }),
};

export const leavesAPI = {
  upsertEntry: (data)                     => api.put("/leaves/entry", data),
  getMonth:    (resourceId, month)        => api.get(`/leaves/month?resource_id=${resourceId}&month=${month}`),
  getHolidays: (year, month)              => api.get(`/holidays?year=${year}&month=${month}`),
};

export const demandsAPI = {
  list:         (params)     => api.get("/demands", { params }),
  get:          (id)         => api.get(`/demands/${id}`),
  create:       (data)       => api.post("/demands", data),
  update:       (id, data)   => api.put(`/demands/${id}`, data),
  delete:       (id)         => api.delete(`/demands/${id}`),
  transition:   (id, data)   => api.patch(`/demands/${id}/transition`, data),
  convert:      (id, data)   => api.post(`/demands/${id}/convert`, data),
  seed:         ()           => api.post("/demands/seed"),
};

export const profilesAPI = {
  list:              ()           => api.get("/profiles"),
  get:               (id)         => api.get(`/profiles/${id}`),
  create:            (data)       => api.post("/profiles", data),
  update:            (id, data)   => api.put(`/profiles/${id}`, data),
  delete:            (id)         => api.delete(`/profiles/${id}`),
  duplicate:         (id, data)   => api.post(`/profiles/${id}/duplicate`, data),
  getPermissions:    ()           => api.get("/profiles/permissions"),
  seedFull:          ()           => api.post("/profiles/seed-full"),
};

export const usersAPI = {
  list:              (params)     => api.get("/admin/users", { params }),
  updateProfile:     (id, data)   => api.patch(`/admin/users/${id}`, data),
};

export const safeAPI = {
  // Trains
  listTrains:      () => api.get("/safe/trains"),
  getTrainOverview:(id) => api.get(`/safe/trains/${id}/overview`),
  createTrain:     (data) => api.post("/safe/trains", data),
  updateTrain:     (id, data) => api.put(`/safe/trains/${id}`, data),
  deleteTrain:     (id) => api.delete(`/safe/trains/${id}`),
  // PIs
  listPIs:         (params) => api.get("/safe/pis", { params }),
  createPI:        (data) => api.post("/safe/pis", data),
  updatePI:        (id, data) => api.put(`/safe/pis/${id}`, data),
  deletePI:        (id) => api.delete(`/safe/pis/${id}`),
  // Sprints
  listSprints:     (params) => api.get("/safe/sprints", { params }),
  createSprint:    (data) => api.post("/safe/sprints", data),
  updateSprint:    (id, data) => api.put(`/safe/sprints/${id}`, data),
  deleteSprint:    (id) => api.delete(`/safe/sprints/${id}`),
  // Capabilities
  listCapabilities:(params) => api.get("/safe/capabilities", { params }),
  createCapability:(data) => api.post("/safe/capabilities", data),
  updateCapability:(id, data) => api.put(`/safe/capabilities/${id}`, data),
  deleteCapability:(id) => api.delete(`/safe/capabilities/${id}`),
  // Tasks phase lifecycle
  transitionPhase: (taskId, data) => api.post(`/tasks/${taskId}/transition`, data),
  getPhaseHistory: (taskId) => api.get(`/tasks/${taskId}/phase-history`),
  updatePhaseEstimates: (taskId, data) => api.put(`/tasks/${taskId}/phase-estimates`, data),
};

export const vendorsAPI = {
  list:    (params) => api.get("/resources", { params: { ...params, resource_type_in: "externe_regie,externe_forfait" } }),
  update:  (id, data) => api.put(`/resources/${id}`, data),
  summary: () => api.get("/vendors/summary"),
  projectCosts: (projectId) => api.get(`/vendors/project/${projectId}`),
};

export const adminConfigAPI = {
  get:             ()    => api.get("/admin/config"),
  seed:            ()    => api.post("/admin/config/seed"),
  updateModules:   (d)   => api.put("/admin/config/modules", d),
  updateWorkflows: (d)   => api.put("/admin/config/workflows", d),
  updateEnums:     (d)   => api.put("/admin/config/enums", d),
  updateHolidays:  (d)   => api.put("/admin/config/holidays", d),
  updateThresholds:(d)   => api.put("/admin/config/thresholds", d),
  updateBranding:  (d)   => api.put("/admin/config/ppt-branding", d),
};

export const okrsAPI = {
  list:        (params)     => api.get("/okrs", { params }),
  create:      (data)       => api.post("/okrs", data),
  update:      (id, data)   => api.put(`/okrs/${id}`, data),
  delete:      (id)         => api.delete(`/okrs/${id}`),
  dashboard:   ()           => api.get("/programme/dashboard"),
  updateWSJF:  (capId, data) => api.put(`/capabilities/${capId}/wsjf`, data),
};

export const scopeAPI = {
  getCandidates:    (params)             => api.get("/scope/candidates", { params }),
  patchStatus:      (taskId, data)       => api.patch(`/scope/tasks/${taskId}/status`, data),
  getCapacity:      (params)             => api.get("/scope/capacity", { params }),
  createSnapshot:   (data)               => api.post("/scope/snapshots", data),
  listSnapshots:    (params)             => api.get("/scope/snapshots", { params }),
  getSnapshot:      (id)                 => api.get(`/scope/snapshots/${id}`),
  transmitSnapshot: (id, data)           => api.post(`/scope/snapshots/${id}/transmit`, data),
  computeGantt:     (id)                 => api.post(`/scope/snapshots/${id}/gantt-compute`),
  getUsers:         ()                   => api.get("/admin/users"),
};

export default api;
