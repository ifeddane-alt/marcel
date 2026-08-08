const KEY = "marcel_recent_projects";
const MAX = 6;

export function getRecentProjects(userId) {
  try {
    return JSON.parse(localStorage.getItem(`${KEY}_${userId || "anon"}`)) || [];
  } catch {
    return [];
  }
}

export function pushRecentProject(userId, p) {
  if (!p?.project_id) return;
  const entry = {
    project_id: p.project_id,
    name: p.name,
    code: p.code || "",
    status_rag: p.status_rag,
  };
  const list = getRecentProjects(userId).filter((x) => x.project_id !== p.project_id);
  list.unshift(entry);
  try {
    localStorage.setItem(`${KEY}_${userId || "anon"}`, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* quota */
  }
}
