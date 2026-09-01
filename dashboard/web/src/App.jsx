import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  fetchSummary,
  fetchTrend,
  fetchByCategory,
  fetchByStore,
  fetchTopProducts,
  fetchInventoryRisk,
} from "./api";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function formatCurrency(value) {
  if (value == null) return "-";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function Scorecard({ label, value }) {
  return (
    <div className="scorecard">
      <div className="scorecard-label">{label}</div>
      <div className="scorecard-value">{value}</div>
    </div>
  );
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [byStore, setByStore] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventoryRisk, setInventoryRisk] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchSummary().then(setSummary),
      fetchTrend().then(setTrend),
      fetchByCategory().then(setByCategory),
      fetchByStore().then(setByStore),
      fetchTopProducts(10).then(setTopProducts),
      fetchInventoryRisk(15).then(setInventoryRisk),
    ]).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="app-error">
        Failed to load dashboard data: {error}
        <br />
        Make sure the API server is running on port 4000.
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>FMCG Analytics Dashboard</h1>
        <p>Sell-through, inventory position, and batch vs. streaming sales -- served live from BigQuery.</p>
      </header>

      <section className="scorecards">
        <Scorecard label="Total Revenue" value={summary ? formatCurrency(summary.total_revenue) : "..."} />
        <Scorecard label="Units Sold" value={summary ? Number(summary.units_sold).toLocaleString("en-IN") : "..."} />
        <Scorecard label="Avg Order Value" value={summary ? formatCurrency(summary.avg_order_value) : "..."} />
      </section>

      <section className="chart-card">
        <h2>Revenue Over Time</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="net_amount" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="chart-row">
        <section className="chart-card half">
          <h2>Revenue by Category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="net_amount" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="chart-card half">
          <h2>Revenue by Store</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStore}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="store_id" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="net_amount" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="chart-row">
        <section className="chart-card half">
          <h2>Revenue Share by Category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="net_amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {byCategory.map((entry, index) => (
                  <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="chart-card half">
          <h2>Top Products</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Brand</th>
                <th>Qty</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.sku}>
                  <td>{p.product_name}</td>
                  <td>{p.brand}</td>
                  <td>{p.quantity}</td>
                  <td>{formatCurrency(p.net_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="chart-card">
        <h2>Inventory Position -- Lowest Stock First (Stockout Risk)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Product</th>
              <th>Category</th>
              <th>Units on Hand</th>
              <th>Units in Transit</th>
            </tr>
          </thead>
          <tbody>
            {inventoryRisk.map((row, i) => (
              <tr key={`${row.store_id}-${row.sku}-${i}`} className={row.units_on_hand < 20 ? "risk-row" : ""}>
                <td>{row.store_id}</td>
                <td>{row.product_name}</td>
                <td>{row.category}</td>
                <td>{row.units_on_hand}</td>
                <td>{row.units_in_transit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
