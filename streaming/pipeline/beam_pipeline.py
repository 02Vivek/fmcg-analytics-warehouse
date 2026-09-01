"""Streaming pipeline: Pub/Sub -> parse (with dead-lettering) -> dedup -> BigQuery.

Run locally first (free, no Dataflow cost) with DirectRunner:
    python beam_pipeline.py \
        --project=fmcg-warehouse-506917 \
        --topic=projects/fmcg-warehouse-506917/topics/dev-pos-events \
        --runner=DirectRunner --streaming

Only once that's confirmed working, run on Dataflow (real cost, short bursts only):
    python beam_pipeline.py \
        --project=fmcg-warehouse-506917 \
        --topic=projects/fmcg-warehouse-506917/topics/dev-pos-events \
        --region=us-central1 --runner=DataflowRunner \
        --temp_location=gs://fmcg-warehouse-506917-dev-landing/dataflow-temp \
        --streaming
"""
import argparse
import json
import logging

import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, StandardOptions
from apache_beam.transforms import window

BQ_TABLE_SCHEMA = {
    "fields": [
        {"name": "transaction_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "store_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "sku", "type": "STRING", "mode": "REQUIRED"},
        {"name": "qty", "type": "INTEGER", "mode": "NULLABLE"},
        {"name": "price", "type": "FLOAT", "mode": "NULLABLE"},
        {"name": "event_ts", "type": "TIMESTAMP", "mode": "NULLABLE"},
    ]
}

DEAD_LETTER_TAG = "dead_letter"


class ParseEventFn(beam.DoFn):
    """Parses a raw Pub/Sub message. Malformed messages go to the dead-letter tag
    instead of crashing the pipeline."""

    def process(self, raw_bytes):
        try:
            event = json.loads(raw_bytes.decode("utf-8"))
            yield {
                "transaction_id": event["transaction_id"],
                "store_id": event["store_id"],
                "sku": event["sku"],
                "qty": int(event["qty"]),
                "price": float(event["price"]),
                "event_ts": event["event_ts"],
            }
        except Exception:
            yield beam.pvalue.TaggedOutput(DEAD_LETTER_TAG, raw_bytes)


def run(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--topic", required=True, help="Full Pub/Sub topic path")
    parser.add_argument(
        "--dlq_topic",
        default=None,
        help="Full Pub/Sub dead-letter topic path (defaults to <topic>-dlq)",
    )
    parser.add_argument(
        "--output_table",
        default="dev_raw.raw_stream_pos",
        help="dataset.table (project comes from --project)",
    )
    known_args, pipeline_args = parser.parse_known_args(argv)
    dlq_topic = known_args.dlq_topic or f"{known_args.topic}-dlq"

    # --project was consumed above for our own use (the BigQuery table path);
    # Beam's own PipelineOptions/DataflowRunner separately requires it too.
    pipeline_args += [f"--project={known_args.project}"]

    options = PipelineOptions(pipeline_args)
    options.view_as(StandardOptions).streaming = True

    with beam.Pipeline(options=options) as pipeline:
        parsed = (
            pipeline
            | "ReadFromPubSub" >> beam.io.ReadFromPubSub(topic=known_args.topic)
            | "ParseEvent"
            >> beam.ParDo(ParseEventFn()).with_outputs(DEAD_LETTER_TAG, main="ok")
        )

        # Malformed messages -> dead-letter topic instead of crashing the pipeline.
        parsed[DEAD_LETTER_TAG] | "WriteDeadLetters" >> beam.io.WriteToPubSub(
            topic=dlq_topic
        )

        (
            parsed.ok
            # 1-minute windows bound how long we remember a transaction_id for
            # dedup purposes -- a duplicate arriving more than a minute apart
            # is treated as a new event, which is an acceptable trade-off here.
            | "Window" >> beam.WindowInto(window.FixedWindows(60))
            | "KeyByTransactionId" >> beam.Map(lambda e: (e["transaction_id"], e))
            | "DedupByKey" >> beam.CombinePerKey(lambda events: next(iter(events)))
            | "DropKey" >> beam.Values()
            | "WriteToBigQuery"
            >> beam.io.WriteToBigQuery(
                table=f"{known_args.project}:{known_args.output_table}",
                schema=BQ_TABLE_SCHEMA,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
                write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
                method=beam.io.WriteToBigQuery.Method.STREAMING_INSERTS,
            )
        )


if __name__ == "__main__":
    logging.getLogger().setLevel(logging.INFO)
    run()
