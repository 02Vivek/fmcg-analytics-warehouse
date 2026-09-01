"""Generates synthetic sales, inventory, and product_master CSVs for one day.

Usage:
    python generate_sales.py [YYYY-MM-DD]

Writes three date-partitioned CSVs under ./sales/, ./inventory/, ./product_master/,
matching the folder layout expected by the batch_ingest Airflow DAG.
"""
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)

NUM_STORES = 20
NUM_PRODUCTS = 200
SALES_ROWS_PER_DAY = 3000
CATEGORIES = ["oral_care", "home_care", "personal_care"]
BRANDS = ["Glimmer", "Northfield", "Cascade Home", "PureLeaf", "Everstate"]


def build_product_master():
    rows = []
    for i in range(1, NUM_PRODUCTS + 1):
        rows.append(
            {
                "sku": f"SKU{i:04d}",
                "product_name": fake.catch_phrase(),
                "brand": random.choice(BRANDS),
                "category": random.choice(CATEGORIES),
                "pack_size": random.choice([1, 2, 4, 6, 12]),
            }
        )
    return pd.DataFrame(rows)


def build_sales(run_date: date):
    rows = []
    for _ in range(SALES_ROWS_PER_DAY):
        qty = random.randint(1, 5)
        unit_price = round(random.uniform(1.5, 20.0), 2)
        discount = round(unit_price * random.choice([0, 0, 0, 0.1, 0.2]), 2)
        sold_at = datetime.combine(run_date, datetime.min.time()) + timedelta(
            seconds=random.randint(0, 86399)
        )
        rows.append(
            {
                "transaction_id": fake.uuid4(),
                "store_id": f"S{random.randint(1, NUM_STORES):03d}",
                "sku": f"SKU{random.randint(1, NUM_PRODUCTS):04d}",
                "qty": qty,
                "unit_price": unit_price,
                "discount": discount,
                "sold_at": sold_at.isoformat(),
            }
        )
    return pd.DataFrame(rows)


def build_inventory(run_date: date):
    rows = []
    for store_num in range(1, NUM_STORES + 1):
        for sku_num in range(1, NUM_PRODUCTS + 1):
            rows.append(
                {
                    "store_id": f"S{store_num:03d}",
                    "sku": f"SKU{sku_num:04d}",
                    "units_on_hand": random.randint(0, 500),
                    "units_in_transit": random.randint(0, 100),
                    "snapshot_date": run_date.isoformat(),
                }
            )
    return pd.DataFrame(rows)


def write_partitioned(df: pd.DataFrame, domain: str, run_date: date):
    out_dir = Path(domain) / run_date.isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{domain}.csv"
    df.to_csv(out_path, index=False)
    print(f"wrote {len(df)} rows -> {out_path}")


def main():
    run_date = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()

    write_partitioned(build_sales(run_date), "sales", run_date)
    write_partitioned(build_inventory(run_date), "inventory", run_date)
    write_partitioned(build_product_master(), "product_master", run_date)


if __name__ == "__main__":
    main()
