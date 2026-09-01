# Contributing to fmcg_dbt

## Naming conventions

- `stg_*` (models/staging/) -- one model per raw source table. Cleanup only:
  type casting, trimming/casing, deduplication, dropping rows missing a
  required key. No joins, no business logic, no aggregation.
- `int_*` (models/intermediate/) -- computed measures and joins that don't
  yet belong in a final fact/dimension (e.g. gross/net amount calculations).
- `fct_*` (models/marts/) -- fact tables. Each one has an explicitly defined
  grain (documented in its `description:` in _marts.yml) that must never be
  violated -- duplicate rows at the grain silently double-count downstream.
- `dim_*` (models/marts/) -- dimension tables. Joined to facts via a
  surrogate key (`*_key`), generated with `dbt_utils.generate_surrogate_key`,
  never via the raw natural key directly.

## Where logic belongs

| Question the model answers                  | Layer        | Materialization |
|-----------------------------------------------|--------------|------------------|
| "What did the raw source actually send?"       | raw (BigQuery, not dbt) | table (loaded by Airflow) |
| "Is this row clean/deduplicated/typed?"        | staging      | view             |
| "What's the computed measure/join?"            | intermediate | view             |
| "What does the business query for reporting?"  | marts        | table (incremental for large facts) |

## Testing

- Every key column gets `unique` + `not_null`.
- Every foreign key gets `relationships` back to its dimension.
- Every categorical column with a known fixed set of values gets
  `accepted_values`.
- Business-rule checks that can't be expressed as a generic test (e.g.
  "amount must never be negative") go in `tests/` as a singular test: a
  query that returns the *offending* rows. Zero rows returned = test passes.

## Trade-offs / known limitations

See `docs/trade_offs.txt` in the repo root for a running log of intentional
simplifications made in this build and what the "real" fix would look like.
