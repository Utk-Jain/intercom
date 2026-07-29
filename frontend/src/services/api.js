const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { ...getAuthHeaders(), ...options.headers };
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP Error ${response.status}`);
  }
  return response.json();
}

// Auth API
export const apiAuth = {
  signup: (data) => request("/signup", { method: "POST", body: JSON.stringify(data) }),
  signupInvite: (data) => request("/signup/invite", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
  },
  getUser: () => {
    const info = localStorage.getItem("user_info");
    return info ? JSON.parse(info) : null;
  }
};

// Users & Members API
export const apiUsers = {
  getMembers: () => request("/members"),
  inviteMember: (email) => request("/invite", { method: "POST", body: JSON.stringify({ email }) }),
};

// Conversations API
export const apiConversations = {
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.channel) params.append("channel", filters.channel);
    if (filters.status) params.append("status", filters.status);
    if (filters.assignee_id) params.append("assignee_id", filters.assignee_id);
    const q = params.toString();
    return request(`/conversations${q ? `?${q}` : ""}`);
  },
  get: (id) => request(`/conversations/${id}`),
  update: (id, data) => request(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  sendMessage: (id, body) => request(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
};

// Knowledge Base API
export const apiKB = {
  getCategories: () => request("/categories"),
  createCategory: (name) => request("/categories", { method: "POST", body: JSON.stringify({ name }) }),
  getArticles: () => request("/articles"),
  createArticle: (data) => request("/articles", { method: "POST", body: JSON.stringify(data) }),
  updateArticle: (id, data) => request(`/articles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getPublicHelp: (workspaceId, q = "", categoryId = "") => {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (categoryId) params.append("category_id", categoryId);
    return request(`/help/${workspaceId}${params.toString() ? `?${params.toString()}` : ""}`);
  }
};

// AI Summary API
export const apiAI = {
  getSummary: (conversation_id) => request("/summary", { method: "POST", body: JSON.stringify({ conversation_id }) }),
};

// Settings API
export const apiSettings = {
  get: () => request("/workspace"),
  updateDomain: (custom_domain) => request("/workspace/domain", { method: "PATCH", body: JSON.stringify({ custom_domain }) }),
};
