terraform {
  backend "gcs" {
    bucket = "fmcg-warehouse-506917-tfstate"
    prefix = "fmcg-warehouse"
  }
}
