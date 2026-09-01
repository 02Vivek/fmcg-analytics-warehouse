from datetime import datetime

from airflow import DAG
from airflow.providers.google.cloud.sensors.gcs import GCSObjectExistenceSensor
from airflow.providers.google.cloud.transfers.gcs_to_bigquery import GCSToBigQueryOperator

BUCKET = "fmcg-warehouse-506917-dev-landing"

with DAG(
    dag_id="batch_ingest",
    schedule="@daily",
    start_date=datetime(2026, 8, 1),
    catchup=False,
) as dag:

    for domain in ["sales", "inventory", "product_master"]:
        wait = GCSObjectExistenceSensor(
            task_id=f"wait_{domain}",
            bucket=BUCKET,
            object=f"{domain}/{{{{ ds }}}}/{domain}.csv",
        )
        load = GCSToBigQueryOperator(
            task_id=f"load_{domain}",
            bucket=BUCKET,
            source_objects=[f"{domain}/{{{{ ds }}}}/{domain}.csv"],
            destination_project_dataset_table=f"dev_raw.raw_{domain}",
            source_format="CSV",
            skip_leading_rows=1,
            autodetect=True,
            write_disposition="WRITE_TRUNCATE",
        )
        wait >> load
