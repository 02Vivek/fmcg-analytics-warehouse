"""Publishes fake POS transaction events to Pub/Sub in a loop.

Usage:
    python publish_pos_events.py

Run this only in short bursts while testing the streaming pipeline --
stop it (Ctrl+C) as soon as you're done. It publishes forever otherwise.
"""
import json
import random
import time
import uuid
from datetime import datetime

from google.cloud import pubsub_v1

PROJECT_ID = "fmcg-warehouse-506917"
TOPIC_ID = "dev-pos-events"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)


def build_event():
    return {
        "transaction_id": str(uuid.uuid4()),
        "store_id": f"S{random.randint(1, 20):03d}",
        "sku": f"SKU{random.randint(1, 200):04d}",
        "qty": random.randint(1, 5),
        "price": round(random.uniform(1, 20), 2),
        "event_ts": datetime.utcnow().isoformat(),
    }


def main():
    print(f"Publishing to {topic_path} -- press Ctrl+C to stop.")
    published = 0
    try:
        while True:
            event = build_event()
            publisher.publish(topic_path, json.dumps(event).encode("utf-8"))
            published += 1
            if published % 10 == 0:
                print(f"published {published} events...")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print(f"\nStopped. Published {published} events total.")


if __name__ == "__main__":
    main()
