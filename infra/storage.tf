resource "google_storage_bucket" "landing" {
  name                        = "${var.project_id}-${var.env}-landing"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}
