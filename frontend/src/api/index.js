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
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/")) {
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
  account: () => api.get("/auth/account"),
  changePassword: (data) => api.post("/auth/change-password", data),
  ssoProviders: (email) => api.get(`/auth/sso/providers?email=${encodeURIComponent(email)}`),
  ssoExchange: (code) => api.post("/auth/sso/exchange", { code }),
  mfaStatus: () => api.get("/auth/mfa/status"),
  mfaSetup: () => api.post("/auth/mfa/setup"),
  mfaEnable: (code) => api.post("/auth/mfa/enable", { code }),
  mfaDisable: (code) => api.post("/auth/mfa/disable", { code }),
  mfaVerify: (ticket, code) => api.post("/auth/mfa/verify", { ticket, code }),
};

export const favoritesAPI = {
  list: () => api.get("/favorites"),
  toggle: (projectId) => api.post("/favorites/toggle", { project_id: projectId }),
};

export const homeAPI = {
  summary: () => api.get("/home/summary"),
};

export const projectsAPI = {
  list: () => api.get("/projects"),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post("/projects", data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  nextCode: (programId) => api.get("/projects/next-code", { params: programId ? { program_id: programId } : {} }),
  getBenefits: (id) => api.get(`/projects/${id}/benefits`),
  setBenefits: (id, data) => api.put(`/projects/${id}/benefits`, data),
};

export const teamsAPI = {
  list: () => api.get("/teams"),
  get: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post("/teams", data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  capacityHeatmap: (months = 6) => api.get(`/teams/capacity-heatmap?months=${months}`),
  exportCapacityHeatmap: (months = 6) => api.get(`/teams/capacity-heatmap/export?months=${months}`, { responseType: "blob" }),
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
  create: (data) => api.post("/governance", data),
  update: (id, data) => api.put(`/governance/${id}`, data),
  delete: (id) => api.delete(`/governance/${id}`),
  invitationPdf: (id) => api.get(`/governance/${id}/invitation-pdf`, { responseType: "blob" }),
};

export const lifecycleAPI = {
  referential: () => api.get("/lifecycle/referential"),
  portfolio: () => api.get("/lifecycle/portfolio"),
  myReviews: () => api.get("/lifecycle/my-reviews"),
  project: (id) => api.get(`/projects/${id}/lifecycle`),
  setPhase: (id, phase) => api.put(`/projects/${id}/lifecycle/phase`, { phase }),
  requestGate: (id, data) => api.post(`/projects/${id}/lifecycle/gates`, data),
  cancelGate: (gateId) => api.delete(`/lifecycle/gates/${gateId}`),
  updateDeliverable: (gateId, key, data) => api.put(`/lifecycle/gates/${gateId}/deliverables/${key}`, data),
  reviewDeliverable: (gateId, key, data) => api.post(`/lifecycle/gates/${gateId}/deliverables/${key}/review`, data),
  decide: (gateId, data) => api.post(`/lifecycle/gates/${gateId}/decision`, data),
};

export const objectivesAPI = {
  list: () => api.get("/objectives"),
  alignment: () => api.get("/objectives/alignment"),
  create: (data) => api.post("/objectives", data),
  update: (id, data) => api.put(`/objectives/${id}`, data),
  delete: (id) => api.delete(`/objectives/${id}`),
  setProjects: (id, projectIds) => api.put(`/objectives/${id}/projects`, { project_ids: projectIds }),
  updateTarget: (id, value) => api.post(`/objectives/${id}/target-value`, { value }),
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
  extras: () => api.get("/dashboard/extras"),
  getDashboardPreferences: () => api.get("/dashboard/preferences"),
  updateDashboardPreferences: (d) => api.put("/dashboard/preferences", d),
  cxo: () => api.get("/dashboard/cxo"),
  getCxoPreferences: () => api.get("/dashboard/cxo/preferences"),
  updateCxoPreferences: (d) => api.put("/dashboard/cxo/preferences", d),
  exportPdf: () => api.get("/dashboard/export/pdf", { responseType: "blob" }),
};

export const searchAPI = {
  global: (q) => api.get("/search/global", { params: { q } }),
};

export const excelAPI = {
  exportEntity:  (entity)           => api.get(`/excel/${entity}/export`, { responseType: "blob" }),
  importPreview: (entity, formData) => api.post(`/excel/${entity}/import/preview`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  importCommit:  (entity, rows)     => api.post(`/excel/${entity}/import/commit`, { rows }),
};

export const msprojectAPI = {
  exportXml: (projectId) => api.get(`/msproject/export/${projectId}`, { responseType: "blob" }),
  importXml: (projectId, formData) => api.post(`/msproject/import/${projectId}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  analyze: (projectId, formData) => api.post(`/msproject/analyze/${projectId}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  importNew: (formData) => api.post("/msproject/import-new", formData, { headers: { "Content-Type": "multipart/form-data" } }),
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
  create:            (data)       => api.post("/admin/users", data),
  updateProfile:     (id, data)   => api.patch(`/admin/users/${id}`, data),
  resetPassword:     (id, data)   => api.post(`/admin/users/${id}/reset-password`, data),
};

export const auditAPI = {
  list: (params) => api.get("/admin/audit-logs", { params }),
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
  // Features ↔ PI
  piFeatures:        (piId) => api.get(`/safe/pis/${piId}/features`),
  featureCandidates: () => api.get("/safe/features/candidates"),
  assignFeaturePI:   (taskId, piId) => api.patch(`/safe/features/${taskId}/pi`, { pi_id: piId }),
  setFeatureWSJF:    (taskId, wsjf) => api.patch(`/safe/features/${taskId}/wsjf`, { wsjf }),
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
  updateWebhooks:  (d)   => api.put("/admin/config/webhooks", d),
  updateProjectCodes: (d) => api.put("/admin/config/project-codes", d),
  backfillProjectCodes: () => api.post("/admin/config/project-codes/backfill"),
  updateEmailAlerts: (d) => api.put("/admin/config/email-alerts", d),
  runContractCheck: () => api.post("/admin/config/email-alerts/contracts/run"),
  updateSSO:       (d)   => api.put("/admin/config/sso", d),
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
  exportSnapshotExcel: (id)              => api.get(`/scope/snapshots/${id}/export-excel`, { responseType: "blob" }),
  exportCandidatesExcel: (params)        => api.get("/scope/export-excel", { params, responseType: "blob" }),
};

export const arbitrageAPI = {  getSummary:      ()           => api.get("/arbitrage/summary"),
  getWeights:      ()           => api.get("/arbitrage/weights"),
  updateWeights:   (data)       => api.put("/arbitrage/weights", data),
  patchScoring:    (id, data)   => api.patch(`/arbitrage/projects/${id}/scoring`, data),
  getEnvelopes:    ()           => api.get("/arbitrage/envelopes"),
  upsertEnvelope:  (data)       => api.post("/arbitrage/envelopes", data),
  deleteEnvelope:  (id)         => api.delete(`/arbitrage/envelopes/${id}`),
  getScenarios:    ()           => api.get("/arbitrage/scenarios"),
  getScenario:     (id)         => api.get(`/arbitrage/scenarios/${id}`),
  saveScenario:    (data)       => api.post("/arbitrage/scenarios", data),
  applyScenario:   (id)         => api.post(`/arbitrage/scenarios/${id}/apply`),
  deleteScenario:  (id)         => api.delete(`/arbitrage/scenarios/${id}`),
};

export const connectorsAPI = {
  listAll:         ()           => api.get("/connectors"),
  getConfig:       (type)       => api.get(`/connectors/${type}/config`),
  updateConfig:    (type, data) => api.put(`/connectors/${type}/config`, data),
  updateMapping:   (type, data) => api.put(`/connectors/${type}/mapping`, data),
  testConnection:  (type)       => api.post(`/connectors/${type}/test`),
  triggerSync:     (type)       => api.post(`/connectors/${type}/sync`),
  getStatus:       (type)       => api.get(`/connectors/${type}/status`),
  getLogs:         (type, limit) => api.get(`/connectors/${type}/logs`, { params: limit ? { limit } : {} }),
  remoteProjects:  (type)        => api.get(`/connectors/${type}/remote-projects`),
};

export const aiReportAPI = {
  generate: (projectId)           => api.post(`/projects/${projectId}/ai-report`),
  list:     (projectId)           => api.get(`/projects/${projectId}/ai-reports`),
  pdf:      (projectId, reportId) => api.get(`/projects/${projectId}/ai-report/${reportId}/pdf`, { responseType: "blob" }),
};

export const agentAPI = {
  chat:              (data)       => api.post("/agent/chat", data),
  listSessions:      ()           => api.get("/agent/sessions"),
  getSessionHistory: (sessionId)  => api.get(`/agent/sessions/${sessionId}/history`),
  getRecommendations:()           => api.get("/agent/recommendations"),
  exportRecoPDF:     ()           => api.get("/agent/recommendations/export-pdf", { responseType: "blob" }),
  exportRecoExcel:   ()           => api.get("/agent/recommendations/export-excel", { responseType: "blob" }),
  listAlertRules:    ()           => api.get("/agent/alert-rules"),
  createAlertRule:   (data)       => api.post("/agent/alert-rules", data),
  updateAlertRule:   (id, data)   => api.put(`/agent/alert-rules/${id}`, data),
  deleteAlertRule:   (id)         => api.delete(`/agent/alert-rules/${id}`),
  getAgentAnalytics: ()           => api.get("/admin/agent-analytics"),
};

export const budgetAPI = {
  consolidated: (params = {}) => api.get("/budget/consolidated", { params }),
  byProgram:    ()             => api.get("/budget/by-program"),
  multiyear:    ()             => api.get("/budget/multiyear"),
  multiyearExcel: ()           => api.get("/budget/multiyear/export/excel", { responseType: "blob" }),
  setMultiyear: (id, data)     => api.put(`/budget/project/${id}/multiyear`, data),
  projectRevisions: (id)       => api.get(`/budget/project/${id}/revisions`),
  revise:       (id, data)     => api.post(`/budget/project/${id}/revise`, data),
  exportExcel:  ()             => api.get("/budget/export/excel", { responseType: "blob" }),
  exportPdf:    ()             => api.get("/budget/export/pdf", { responseType: "blob" }),
};

export const powerBIAPI = {
  getKey:      ()     => api.get("/admin/powerbi/key"),
  generateKey: ()     => api.post("/admin/powerbi/generate-key"),
  revokeKey:   ()     => api.delete("/admin/powerbi/revoke-key"),
  projects:    ()     => api.get("/powerbi/projects"),
  resources:   ()     => api.get("/powerbi/resources"),
  timesheets:  ()     => api.get("/powerbi/timesheets"),
  budget:      ()     => api.get("/powerbi/budget"),
  risks:       ()     => api.get("/powerbi/risks"),
  milestones:  ()     => api.get("/powerbi/milestones"),
};

export const statusReportAPI = {
  getWeather:    (projectId)         => api.get(`/projects/${projectId}/weather`),
  generate:      (projectId, data)   => api.post(`/projects/${projectId}/status-report`, data, { responseType: "arraybuffer" }),
  listReports:   (projectId)         => api.get(`/projects/${projectId}/status-reports`),
};

export const projectTemplatesAPI = {
  list:         ()                          => api.get("/project-templates"),
  get:          (id)                        => api.get(`/project-templates/${id}`),
  create:       (data)                      => api.post("/project-templates", data),
  update:       (id, data)                  => api.put(`/project-templates/${id}`, data),
  delete:       (id)                        => api.delete(`/project-templates/${id}`),
  duplicate:    (id)                        => api.post(`/project-templates/${id}/duplicate`),
  applyTemplate:(projectId, data)           => api.post(`/projects/${projectId}/apply-template`, data),
};

export const runAPI = {
  summary:        ()            => api.get("/run/summary"),
  activities:     ()            => api.get("/run/activities"),
  createActivity: (data)        => api.post("/run/activities", data),
  updateActivity: (id, data)    => api.put(`/run/activities/${id}`, data),
  deleteActivity: (id)          => api.delete(`/run/activities/${id}`),
  getAllocations: (id)          => api.get(`/run/activities/${id}/allocations`),
  setAllocations: (id, allocs)  => api.put(`/run/activities/${id}/allocations`, { allocations: allocs }),
  load:           (months = 6)  => api.get(`/run/load?months=${months}`),
  incidents:      ()            => api.get("/run/incidents"),
  createIncident: (data)        => api.post("/run/incidents", data),
  updateIncident: (id, data)    => api.put(`/run/incidents/${id}`, data),
  deleteIncident: (id)          => api.delete(`/run/incidents/${id}`),
  releases:       ()            => api.get("/run/releases"),
  createRelease:  (data)        => api.post("/run/releases", data),
  updateRelease:  (id, data)    => api.put(`/run/releases/${id}`, data),
  deleteRelease:  (id)          => api.delete(`/run/releases/${id}`),
};

export const applicationsAPI = {
  list:        (projectId)  => api.get(`/applications${projectId ? `?project_id=${projectId}` : ""}`),
  summary:     ()           => api.get("/applications/summary"),
  get:         (id)         => api.get(`/applications/${id}`),
  create:      (data)       => api.post("/applications", data),
  update:      (id, data)   => api.put(`/applications/${id}`, data),
  delete:      (id)         => api.delete(`/applications/${id}`),
  setProjects: (id, ids)    => api.put(`/applications/${id}/projects`, { project_ids: ids }),
};

export const indicatorsAPI = {
  portfolio:    ()               => api.get("/indicators/portfolio"),
  project:      (projectId)      => api.get(`/projects/${projectId}/indicators`),
  sprints:      (projectId)      => api.get(`/projects/${projectId}/sprints`),
  createSprint: (projectId, d)   => api.post(`/projects/${projectId}/sprints`, d),
  updateSprint: (id, d)          => api.put(`/indicators/sprints/${id}`, d),
  deleteSprint: (id)             => api.delete(`/indicators/sprints/${id}`),
};

export const portfolioAiAPI = {
  generate: ()   => api.post("/portfolio/ai-report"),
  list:     ()   => api.get("/portfolio/ai-reports"),
  get:      (id) => api.get(`/portfolio/ai-reports/${id}`),
  pdf:      (id) => api.get(`/portfolio/ai-reports/${id}/pdf`, { responseType: "blob" }),
};

export const insightsAPI = {
  list:    (limit = 10) => api.get(`/agent/insights?limit=${limit}`),
  analyze: ()           => api.post("/agent/analyze"),
};

export const pbAPI = {
  list:    ()          => api.get("/pb/sessions"),
  get:     (id)        => api.get(`/pb/sessions/${id}`),
  create:  (data)      => api.post("/pb/sessions", data),
  update:  (id, data)  => api.put(`/pb/sessions/${id}`, data),
  remove:  (id)        => api.delete(`/pb/sessions/${id}`),
  vote:    (id, alloc) => api.post(`/pb/sessions/${id}/vote`, { allocations: alloc }),
  results: (id)        => api.get(`/pb/sessions/${id}/results`),
};

export const securityAPI = {
  summary:  ()          => api.get("/security/summary"),
  posture:  ()          => api.get("/security/posture"),
  vulns: {
    list:   ()          => api.get("/security/vulnerabilities"),
    create: (data)      => api.post("/security/vulnerabilities", data),
    update: (id, data)  => api.put(`/security/vulnerabilities/${id}`, data),
    remove: (id)        => api.delete(`/security/vulnerabilities/${id}`),
  },
  requirements: {
    list:   ()          => api.get("/security/requirements"),
    create: (data)      => api.post("/security/requirements", data),
    update: (id, data)  => api.put(`/security/requirements/${id}`, data),
    remove: (id)        => api.delete(`/security/requirements/${id}`),
  },
  reviews: {
    list:   ()          => api.get("/security/reviews"),
    create: (data)      => api.post("/security/reviews", data),
    update: (id, data)  => api.put(`/security/reviews/${id}`, data),
    remove: (id)        => api.delete(`/security/reviews/${id}`),
  },
};

const archCrud = (entity) => ({
  list:   ()          => api.get(`/architecture/${entity}`),
  create: (data)      => api.post(`/architecture/${entity}`, data),
  update: (id, data)  => api.put(`/architecture/${entity}/${id}`, data),
  remove: (id)        => api.delete(`/architecture/${entity}/${id}`),
});

export const architectureAPI = {
  summary:    ()  => api.get("/architecture/summary"),
  interfaces: archCrud("interfaces"),
  standards:  archCrud("standards"),
  exemptions: archCrud("exemptions"),
  reviews:    archCrud("reviews"),
  radar:      archCrud("radar"),
  debt:       archCrud("debt"),
};

export const skillsAPI = {
  referential: () => api.get("/resources/skills"),
};

export const customFieldsAPI = {
  defs: () => api.get("/projects/custom-fields"),
  saveDefs: (fields) => api.put("/projects/custom-fields", { fields }),
};

export const viewsAPI = {
  list: (page) => api.get(`/views?page=${page}`),
  save: (data) => api.post("/views", data),
  remove: (id) => api.delete(`/views/${id}`),
};

export const snapshotsAPI = {
  list: () => api.get("/portfolio/snapshots"),
  run: () => api.post("/portfolio/snapshots/run"),
};

export const thresholdsAPI = {
  get: () => api.get("/indicators/thresholds"),
  save: (data) => api.put("/indicators/thresholds", data),
};

export default api;

export const eventsAPI = {
  listTypes:    ()          => api.get("/events/types"),
  seedDefaults: ()          => api.post("/events/types/seed-defaults"),
  createType:   (data)      => api.post("/events/types", data),
  updateType:   (id, data)  => api.put(`/events/types/${id}`, data),
  deleteType:   (id)        => api.delete(`/events/types/${id}`),
  generatePlan: (year)      => api.post("/events/generate-plan", { year }),
  list:         (params)    => api.get("/events", { params }),
  create:       (data)      => api.post("/events", data),
  update:       (id, data)  => api.put(`/events/${id}`, data),
  remove:       (id)        => api.delete(`/events/${id}`),
};

export const forecastAPI = {
  quarters:  (year)       => api.get("/forecast/quarters", { params: { year } }),
  validate:  (data)       => api.post("/forecast/validate", data),
  levers:    (projectId)  => api.get("/forecast/levers", { params: projectId ? { project_id: projectId } : {} }),
  applyCuts: (data)       => api.post("/forecast/apply-cuts", data),
  cuts:      ()           => api.get("/forecast/cuts"),
};

export const capacityAPI = {
  console: (horizon, axis) => api.get("/capacity/console", { params: { horizon, axis } }),
};

export const budgetOpsAPI = {
  createTransfer: (data)      => api.post("/budget/transfers", data),
  listTransfers:  ()          => api.get("/budget/transfers"),
  listThemes:     ()          => api.get("/budget/themes"),
  createTheme:    (data)      => api.post("/budget/themes", data),
  deleteTheme:    (id)        => api.delete(`/budget/themes/${id}`),
  listEnvelopes:  (year)      => api.get("/budget/envelopes", { params: { year } }),
  upsertEnvelope: (data)      => api.post("/budget/envelopes", data),
  deleteEnvelope: (id)        => api.delete(`/budget/envelopes/${id}`),
};

export const trajectoryAPI = {
  get:             ()          => api.get("/architecture/trajectory"),
  setDisposition:  (id, data)  => api.put(`/architecture/trajectory/${id}`, data),
  createMilestone: (data)      => api.post("/architecture/trajectory/milestones", data),
  updateMilestone: (id, data)  => api.put(`/architecture/trajectory/milestones/${id}`, data),
  deleteMilestone: (id)        => api.delete(`/architecture/trajectory/milestones/${id}`),
};

export const exportsAPI = {
  copilPptx: () => api.get("/exports/copil.pptx", { responseType: "blob" }),
  eventPptx: (eventId) => api.get(`/exports/event/${eventId}.pptx`, { responseType: "blob" }),
  roadmapPptx: () => api.get("/exports/roadmap.pptx", { responseType: "blob" }),
  pbPptx: (sessionId) => api.get(`/exports/pb/${sessionId}.pptx`, { responseType: "blob" }),
};
