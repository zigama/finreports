// src/api/client.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050';
const TOKEN_KEY = 'frp_token';

// ---- Token helpers ----
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(tok) {
  if (tok) localStorage.setItem(TOKEN_KEY, tok);
  else localStorage.removeItem(TOKEN_KEY);
}

// ---- Core request wrapper ----
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();

  // Do not set JSON header for FormData
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const reqHeaders = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: reqHeaders,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  });

  // Auto logout on unauthorized
  if (res.status === 401) {
    setToken(null);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    throw new Error('Session expired. Please sign in again.');
  }

  // Handle empty/no-content
  if (res.status === 204) return null;

  const ctype = res.headers.get('content-type') || '';
  const isJson = ctype.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (isJson && (data?.message || data?.error || data?.msg)) ||
      res.statusText ||
      'Request failed';
    throw new Error(msg);
  }
  return data;
}

// ---- Auth helpers ----
export async function login(username, password) {
  const data = await request('/auth/login', { method: 'POST', body: { username, password } });
  if (data?.access_token) setToken(data.access_token);
  return data;
}

// server revoke + local clear (used by hooks or header menu)
export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore network errors */ }
  }
  setToken(null);
  return { ok: true };
}

// ---- API wrappers ----
export const api = {
  facilities: () => request('/facilities'),
  provinces: () => request('/provinces'),
  quarterSummary: ({ facility_id, year, quarter }) =>
    request(`/reports/summary?facility_id=${facility_id}&year=${year}&quarter=${quarter}`),
};

export const catalog = {
  countries: () => request('/countries'),
  createCountry: (b) => request('/countries', { method: 'POST', body: b }),

  provinces: (country_id) => request(`/provinces${country_id ? `?country_id=${country_id}` : ''}`),
  createProvince: (b) => request('/provinces', { method: 'POST', body: b }),

  districts: (province_id) => request(`/districts${province_id ? `?province_id=${province_id}` : ''}`),
  createDistrict: (b) => request('/districts', { method: 'POST', body: b }),

  hospitals: (filters = {}) => {
    const q = new URLSearchParams();
    if (filters.province_id) q.set('province_id', filters.province_id);
    if (filters.district_id) q.set('district_id', filters.district_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/hospitals${qs}`);
  },
  createHospital: (b) => request('/hospitals', { method: 'POST', body: b }),

  facilities: (filters = {}) => {
    const q = new URLSearchParams();
    ['country_id', 'province_id', 'district_id', 'referral_hospital_id'].forEach((k) => {
      if (filters[k]) q.set(k, filters[k]);
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/facilities${qs}`);
  },
  createFacility: (b) => request('/facilities', { method: 'POST', body: b }),
};

export const FacilityLevels = [
  'National Referral Hospital',
  'Province Referral Hospital',
  'District Hospital',
  'Health Centre',
];

// ---- Budgeting endpoints ----
export const budgeting = {
  // Budget Lines
  listBudgetLines: (q) => request(`/budget-lines${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createBudgetLine: (b) => request('/budget-lines', { method: 'POST', body: b }),

  // Activities
  listActivities: (filters = {}) => {
    const q = new URLSearchParams();
    if (filters.budget_line_id) q.set('budget_line_id', filters.budget_line_id);
    if (filters.q) q.set('q', filters.q);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/activities${qs}`);
  },
  createActivity: (b) => request('/activities', { method: 'POST', body: b }),

  // Budgets
  listBudgets: (filters = {}) => {
    const q = new URLSearchParams();
    ['hospital_id','facility_id','budget_line_id','activity_id','level','q'].forEach(k=>{
      if (filters[k]) q.set(k, filters[k]);
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/budgets${qs}`);
  },
  createBudget: (b) => request('/budgets', { method: 'POST', body: b }),
  updateBudget: (id, b) => request(`/budgets/${id}`, { method: 'PUT', body: b }),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
};

budgeting.listBudgetsPaged = ({ page=0, pageSize=25, sortBy, sortDir, filters={} } = {}) => {
  const q = new URLSearchParams();
  q.set('page', page);
  q.set('page_size', pageSize);
  if (sortBy) q.set('sort_by', sortBy);
  if (sortDir) q.set('sort_dir', sortDir);
  ['hospital_id','facility_id','budget_line_id','activity_id','level','q'].forEach(k=>{
    if (filters[k] !== undefined && filters[k] !== '' && filters[k] !== null) q.set(k, filters[k]);
  });
  return request(`/budgets?${q.toString()}`);
};

budgeting.aggregateBudgets = (filters = {}) => {
  const q = new URLSearchParams();
  ['hospital_id','facility_id','budget_line_id','activity_id','level','q'].forEach(k=>{
    if (filters[k] !== undefined && filters[k] !== '' && filters[k] !== null) q.set(k, filters[k]);
  });
  return request(`/budgets/aggregate?${q.toString()}`);
};

// ---- Cashbook endpoints (use request/API_BASE + normalized listAccounts) ----
export const cashbook = {
  async listCashbooks({ page = 0, pageSize = 25, sortBy = 'transaction_date', sortDir = 'desc', filters = {} } = {}) {
    const q = new URLSearchParams();
    if (filters.q) q.set('q', filters.q);
    if (sortBy) q.set('sortBy', sortBy);
    if (sortDir) q.set('sortDir', sortDir);
    q.set('page', page);
    q.set('pageSize', pageSize);
    const data = await request(`/cashbooks?${q.toString()}`);
    return Array.isArray(data) ? { items: data, total: data.length } : data;
  },

  create(payload) {
    return request('/cashbooks', { method: 'POST', body: payload });
  },

  update(id, payload) {
    return request(`/cashbooks/${id}`, { method: 'PATCH', body: payload });
  },

  remove(id) {
    return request(`/cashbooks/${id}`, { method: 'DELETE' });
  },

  // Accounts
  listAccounts() {
    // Always return an array so UI can safely .map()
    return request('/accounts').then((data) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.items)) return data.items;
      return [];
    });
  },
  createAccount(payload) {
    return request('/accounts', { method: 'POST', body: payload });
  },
  updateAccount(id, payload) {
    return request(`/accounts/${id}`, { method: 'PATCH', body: payload });
  },
  deleteAccount(id) {
    return request(`/accounts/${id}`, { method: 'DELETE' });
  },
};

export { API_BASE };
export default { request, api, catalog, budgeting, cashbook, login, logout, getToken, setToken, API_BASE };
