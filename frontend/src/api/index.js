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
};

export const resourcesAPI = {
  list: () => api.get("/resources"),
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

export const dashboardAPI = {
  summary: () => api.get("/dashboard/summary"),
};

export default api;
