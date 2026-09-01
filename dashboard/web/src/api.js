const BASE_URL = "/api";

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

export const fetchSummary = () => get("/summary");
export const fetchTrend = () => get("/trend");
export const fetchByCategory = () => get("/by-category");
export const fetchByStore = () => get("/by-store");
export const fetchTopProducts = (limit = 10) => get(`/top-products?limit=${limit}`);
export const fetchSourceSplit = () => get("/source-split");
export const fetchInventoryRisk = (limit = 20) => get(`/inventory-risk?limit=${limit}`);
