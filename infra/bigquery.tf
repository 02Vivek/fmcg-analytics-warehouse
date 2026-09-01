resource "google_bigquery_dataset" "layers" {
  for_each   = toset(["raw", "staging", "marts"])
  dataset_id = "${var.env}_${each.value}"
  location   = var.region
}
