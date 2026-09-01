resource "google_project_service" "apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "pubsub.googleapis.com",
    "storage.googleapis.com",
    "dataflow.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}
