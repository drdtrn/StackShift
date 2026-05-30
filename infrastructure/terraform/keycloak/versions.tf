terraform {
  required_version = ">= 1.6"

  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "~> 5.0"
    }
  }

  # State backend = in-stack MinIO (S3-compatible), not AWS. bucket/key/region +
  # endpoints + access_key/secret_key are supplied at `terraform init` time via
  # -backend-config (see README). The static MinIO-compatibility flags below are
  # not secrets and stay in the block.
  backend "s3" {
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
  }
}

provider "keycloak" {
  client_id     = "admin-cli"
  username      = var.kc_bootstrap_admin
  password      = var.kc_bootstrap_password
  url           = var.kc_base_url
  realm         = "master"
  initial_login = false
}
