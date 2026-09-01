resource "google_service_account" "pipeline" {
  account_id   = "${var.env}-fmcg-pipeline"
  display_name = "FMCG pipeline (${var.env})"
}

resource "google_project_iam_member" "roles" {
  for_each = toset([
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/storage.objectAdmin",
    "roles/pubsub.editor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
