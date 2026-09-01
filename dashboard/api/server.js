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

const app = express();
app.use(cors());

app.get("/api/summary", async (req, res) => {
  try {
    const rows = await query(`
      select
        sum(net_amount) as total_revenue,
        sum(quantity) as units_sold,
        avg(net_amount) as avg_order_value
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\`
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/trend", async (req, res) => {
  try {
    const rows = await query(`
      select d.date, sum(f.net_amount) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_date\` d on f.date_key = d.date_key
      group by d.date
      order by d.date
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/by-category", async (req, res) => {
  try {
    const rows = await query(`
      select p.category, sum(f.net_amount) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      group by p.category
      order by net_amount desc
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/by-store", async (req, res) => {
  try {
    const rows = await query(`
      select st.store_id, sum(f.net_amount) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_store\` st on f.store_key = st.store_key
      group by st.store_id
      order by net_amount desc
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/top-products", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  try {
    const rows = await query(`
      select p.product_name, p.sku, p.brand,
             sum(f.quantity) as quantity,
             sum(f.net_amount) as net_amount
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\` f
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      group by p.product_name, p.sku, p.brand
      order by net_amount desc
      limit ${limit}
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/source-split", async (req, res) => {
  try {
    const rows = await query(`
      select source_type, sum(net_amount) as net_amount, count(*) as row_count
      from \`${PROJECT_ID}.dev_marts.fct_sales_unified\`
      group by source_type
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/inventory-risk", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  try {
    const rows = await query(`
      select st.store_id, p.product_name, p.sku, p.category,
             f.units_on_hand, f.units_in_transit
      from \`${PROJECT_ID}.dev_marts.fct_inventory\` f
      left join \`${PROJECT_ID}.dev_marts.dim_store\` st on f.store_key = st.store_key
      left join \`${PROJECT_ID}.dev_marts.dim_product\` p on f.product_key = p.product_key
      order by f.units_on_hand asc
      limit ${limit}
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`FMCG dashboard API listening on http://localhost:${PORT}`);
});
