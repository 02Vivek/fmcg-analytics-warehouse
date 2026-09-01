const express = require("express");
const cors = require("cors");
const { BigQuery } = require("@google-cloud/bigquery");

const PROJECT_ID = process.env.GCP_PROJECT_ID || "fmcg-warehouse-506917";
const PORT = process.env.PORT || 4000;

const bigquery = new BigQuery({ projectId: PROJECT_ID });

async function query(sql) {
  const [rows] = await bigquery.query({ query: sql, location: "us-central1" });
  return rows;
}

// BigQuery's Node client returns NUMERIC as strings and DATE as {value: "..."}
// objects (to avoid precision loss). Convert both to plain JS types for the API.
function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === "object" && "value" in value) {
      out[key] = value.value;
    } else if (typeof value === "string" && value !== "" && !isNaN(Number(value))) {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

const app = express();
app.use(cors());

app.get("/api/summary", async (req, res) => {
  try {
    const rows = await query(`
      select
        cast(sum(net_amount) as float64) as total_revenue,
        cast(sum(quantity) as float64) as units_sold,
        cast(avg(net_amount) as float64) as avg_order_value
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\`
    `);
    res.json(normalizeRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/trend", async (req, res) => {
  try {
    const rows = await query(`
      select cast(d.date as string) as date, cast(sum(f.net_amount) as float64) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_date\` d on f.date_key = d.date_key
      group by d.date
      order by d.date
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/by-category", async (req, res) => {
  try {
    const rows = await query(`
      select p.category, cast(sum(f.net_amount) as float64) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      group by p.category
      order by net_amount desc
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/by-store", async (req, res) => {
  try {
    const rows = await query(`
      select st.store_id, cast(sum(f.net_amount) as float64) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_store\` st on f.store_key = st.store_key
      group by st.store_id
      order by net_amount desc
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/top-products", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  try {
    const rows = await query(`
      select p.product_name, p.sku, p.brand,
             cast(sum(f.quantity) as float64) as quantity,
             cast(sum(f.net_amount) as float64) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      group by p.product_name, p.sku, p.brand
      order by net_amount desc
      limit ${limit}
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/source-split", async (req, res) => {
  try {
    const rows = await query(`
      select source_type, cast(sum(net_amount) as float64) as net_amount, count(*) as row_count
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\`
      group by source_type
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/inventory-risk", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  try {
    const rows = await query(`
      select st.store_id, p.product_name, p.sku, p.category,
             cast(f.units_on_hand as float64) as units_on_hand,
             cast(f.units_in_transit as float64) as units_in_transit
      from \`${PROJECT_ID}.dev_marts.fct_inventory\` f
      left join \`${PROJECT_ID}.dev_marts.dim_store\` st on f.store_key = st.store_key
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      order by f.units_on_hand asc
      limit ${limit}
    `);
    res.json(normalizeRows(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`FMCG dashboard API listening on http://localhost:${PORT}`);
});
