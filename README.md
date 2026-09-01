# FMCG Analytics Warehouse

A batch + streaming data platform on Google Cloud that ingests retail sales, inventory, and shipment data, models it into a governed Kimball star schema with dbt, and serves it to BI dashboards -- built end-to-end as infrastructure-as-code with a strong emphasis on data quality, cost discipline, and documented design trade-offs.

This project was built to demonstrate the core responsibilities of a data engineering role focused on cloud data warehousing, ETL pipeline development, and analytics enablement for a global FMCG/CPG organization.

## Problem this project solves

Consumer-goods organizations generate sales, inventory, and shipment data across many stores and systems, arriving at different speeds and in inconsistent formats. Back-office systems produce daily batch files (finalized, corrected); store terminals emit live transaction events (immediate, but raw and unreconciled). A single-speed pipeline cannot serve both near-real-time visibility and reconciled, trustworthy reporting.

This project builds a warehouse that:
- Ingests multi-speed, multi-source retail data (batch + streaming) into a single BigQuery warehouse
- Enforces automated data-quality testing on every model, so outputs are trustworthy and auditable
- Models raw data into business-ready dimensional marts answering real commercial questions (sell-through by store, inventory position/stockout risk)
- Runs reproducibly and near-zero-cost, entirely provisioned as code

## Architecture

```
BATCH:  Sources -> Cloud Storage -> Airflow -> BigQuery raw (Bronze)  --\
                                                                          >-- dbt --> Star-schema marts (Gold) --> BI dashboards
STREAM: Sources -> Pub/Sub -> Dataflow (Beam) -> BigQuery raw (Bronze) --/
```

Medallion data-quality progression: **raw** (Bronze, untransformed) -> **staging/intermediate** (Silver, cleaned/typed/deduplicated) -> **marts** (Gold, business-ready facts and dimensions).

![Architecture diagram](docs/fmcg_warehouse_pipeline_flow.svg)

## Tech stack

| Layer | Technology |
|---|---|
| Cloud platform | Google Cloud Platform |
| Infrastructure as code | Terraform |
| Batch storage / landing zone | Cloud Storage |
| Batch orchestration | Apache Airflow (run locally in Docker to avoid Cloud Composer's 24/7 cost) |
| Streaming ingestion | Cloud Pub/Sub |
| Stream processing | Apache Beam, executed on both a local `DirectRunner` and real Google Cloud Dataflow |
| Data warehouse | BigQuery |
| Transformation / modeling | dbt (dbt-bigquery) |
| Language | Python (generators, Beam pipeline), SQL (dbt models) |
| BI / dashboards | Looker Studio, and a custom React + Node/Express dashboard |
| Local containerization | Docker |
| Version control workflow | Git |
| Development partner | Claude Code (Anthropic's agentic CLI) -- used throughout as a hands-on pair-programming partner (see below) |

## What's built

**Infrastructure (Terraform)** -- 100% of cloud resources (landing bucket, three BigQuery datasets, two Pub/Sub topics, a least-privilege service account and its IAM bindings) provisioned as code, with no manual console changes. Verified reproducible: `terraform destroy` followed by `terraform apply` rebuilds an identical environment.

**Batch ingestion pipeline** -- A Python generator produces synthetic sales, inventory, and product-master data; an Airflow DAG senses each day's files landing in Cloud Storage and loads them into BigQuery's raw layer, idempotently (`WRITE_TRUNCATE`, so re-running never duplicates rows).

**Kimball star schema (dbt)** -- Staging models clean and standardize raw data (casting types, trimming/standardizing text, deduplicating on natural keys, dropping structurally invalid rows). Marts build:
- `dim_store`, `dim_date` (via `dbt_utils.date_spine`)
- `dim_product` -- a Slowly Changing Dimension Type 2, built on a dbt snapshot, preserving full history of product attribute changes
- `fct_sales` -- incrementally materialized, line-item grain, joined against the *current* version of each SCD2 dimension row to avoid fan-out duplication
- `fct_inventory` -- product x store x day grain

**Automated data quality** -- 30+ generic tests (`unique`, `not_null`, `relationships`, `accepted_values`) enforced on every key and foreign key across the star schema, plus a custom singular test asserting no sale ever has a negative net amount. `dbt build` runs models and tests together; the full suite passes clean.

**Streaming pipeline** -- A Python generator publishes simulated POS events to Pub/Sub. An Apache Beam pipeline reads, parses (with dead-lettering of malformed events to a dedicated DLQ topic), deduplicates within a windowed key, and writes to BigQuery via streaming inserts. Validated twice: first for free on Beam's local `DirectRunner`, then with a short, deliberately monitored, promptly-cancelled burst on real Google Cloud Dataflow -- proving the same code runs unchanged on managed cloud infrastructure.

**Unified near-real-time mart** -- `fct_sales_unified` combines reconciled batch sales with live streaming events into one mart, tagged by source, directly supporting the latency-vs-correctness trade-off named in this project's design.

**Documented engineering judgment** -- `docs/trade_offs.txt` is a running log of intentional simplifications made during the build (e.g. full-table-truncate vs. partition-scoped writes; unreconciled batch/stream union), each with what was done, why, and what the production-grade fix would look like. `transform/fmcg_dbt/CONTRIBUTING.md` documents naming conventions and where each type of logic belongs.

**BI layer** -- Two serving options on top of the same star schema: a Looker Studio report connected via custom SQL, and a custom-built React dashboard (Node/Express API querying BigQuery directly) surfacing revenue trends, sell-through by store/category/product, and inventory position for stockout-risk visibility.

## Data quality and code standards

- Every staging model does cleanup only -- no joins, no business logic, no aggregation -- one model per source table
- Every fact/dimension key is tested for uniqueness, non-null values, and referential integrity
- A defined naming convention (`stg_` / `int_` / `fct_` / `dim_`) is documented and followed throughout
- Business-rule violations (e.g. impossible values) are surfaced via tests rather than silently patched in transformation, so upstream problems stay visible instead of being hidden

## Cost discipline

The two services that bill continuously regardless of usage -- Cloud Composer and Dataflow -- are handled deliberately: Composer is avoided entirely in favor of local, Docker-based Airflow; Dataflow is run only in short, actively-monitored bursts and cancelled immediately after each test. Every other resource (BigQuery, Cloud Storage, Pub/Sub) operates within Google Cloud's always-free tier at this project's data volume. The entire environment is destroyable and rebuildable in two commands, so nothing runs idle between working sessions.

## Built with an agentic coding workflow

This project's infrastructure, pipelines, dbt models, and documentation were developed collaboratively with **Claude Code** as a working development partner throughout -- scoping multi-file changes (e.g. propagating a project rename across Terraform, dbt, and Airflow configuration), supplying the right files as context for each change, debugging real issues as they surfaced (WSL/Docker integration, BigQuery dataset-location mismatches, Beam pipeline argument handling, SCD2 join fan-out), and course-correcting the design based on what each test run actually showed. Every architectural decision -- from the medallion layering to the SCD2 strategy to the streaming dedup approach -- was reasoned through and verified against real infrastructure before being accepted, not accepted as generated output.

## Repository structure

```
infra/           Terraform: provider, backend, variables, all GCP resources
orchestration/   Local Airflow project (Docker) + the batch ingestion DAG
data/generators/ Synthetic batch data generator
transform/       dbt project: staging, intermediate, marts, snapshots, tests
streaming/       Pub/Sub event generator + Apache Beam pipeline
dashboard/       React + Node/Express dashboard (api/ backend, web/ frontend)
docs/            Architecture diagrams, execution manual, trade-offs log
```

## Status

Phases complete: infrastructure foundation, batch ingestion, dimensional modeling, data quality/testing, and the streaming pipeline (including a validated real-Dataflow run). Two dashboards connect directly to the star schema: a Looker Studio report and a custom React + Node/Express dashboard. CI/CD automation and a fully packaged production deployment are documented as the logical next steps rather than implemented, to keep this build's scope honest about what was actually run and verified versus what the architecture is designed to support.
