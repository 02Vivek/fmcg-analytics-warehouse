resource "google_pubsub_topic" "pos_events" { name = "${var.env}-pos-events" }

resource "google_pubsub_topic" "pos_events_dlq" { name = "${var.env}-pos-events-dlq" }
