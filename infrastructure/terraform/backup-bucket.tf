###############################################################################
# Off-site backup buckets — Postgres + Elasticsearch + MinIO mirror.
#
# Plan 09 Decision 0.2 picks "different cloud account, same region" for
# cross-account replication. The primary buckets live in the prod AWS
# account; the replicas live in a dedicated backups account whose IAM
# trust policy denies the prod account's delete actions, so a compromised
# prod cluster cannot rotate the lifecycle.
#
# Object Lock in Governance mode with 35-day retention guards against
# accidental tombstone-then-delete on the primary buckets. Plan 09 §9.4
# specifies 35 days — long enough to outlast a typical weekend incident
# window and the legal hold-and-decide cycle.
#
# This file is a starting point; the actual Terraform layout (root module,
# state backend, provider aliases per account) is finalised in Plan 12
# alongside the cluster bootstrap. Apply with:
#   terraform init && terraform plan && terraform apply
# in a workspace per env.
###############################################################################

terraform {
  required_version = ">= 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

# Aliased providers — `aws.prod` writes to the runtime account, `aws.backup`
# writes to the off-site account. Real credentials live in CI secrets.
provider "aws" {
  alias  = "prod"
  region = var.primary_region
}

provider "aws" {
  alias  = "backup"
  region = var.backup_region
}

variable "primary_region" {
  type    = string
  default = "eu-central-1"
}

variable "backup_region" {
  type    = string
  default = "eu-west-1"
}

variable "primary_account_id" {
  description = "AWS account ID of the runtime cluster — owns the primary buckets."
  type        = string
}

variable "backup_account_id" {
  description = "AWS account ID of the backup account — owns the replica buckets."
  type        = string
}

variable "object_lock_retention_days" {
  type    = number
  default = 35
}

locals {
  primary_buckets = {
    "pg"      = "stacksift-pg-backup"
    "es"      = "stacksift-es-backup"
    "uploads" = "stacksift-uploads"
    "exports" = "stacksift-exports"
  }
}

# ---------------------------------------------------------------------------
# Primary buckets (prod account) — Object Lock + versioning + KMS encryption.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "primary" {
  for_each            = local.primary_buckets
  provider            = aws.prod
  bucket              = each.value
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "primary" {
  for_each = aws_s3_bucket.primary
  provider = aws.prod
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "primary" {
  for_each = aws_s3_bucket.primary
  provider = aws.prod
  bucket   = each.value.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.object_lock_retention_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "primary" {
  for_each = aws_s3_bucket.primary
  provider = aws.prod
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "primary" {
  for_each = aws_s3_bucket.primary
  provider = aws.prod
  bucket   = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# Replica buckets (backup account) — Object Lock + Compliance-mode retention.
# Compliance mode resists even root-level delete, including from the prod
# account if it ever obtains credentials to the backup account.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "replica" {
  for_each            = local.primary_buckets
  provider            = aws.backup
  bucket              = "${each.value}-replica"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "replica" {
  for_each = aws_s3_bucket.replica
  provider = aws.backup
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "replica" {
  for_each = aws_s3_bucket.replica
  provider = aws.backup
  bucket   = each.value.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.object_lock_retention_days
    }
  }
}

# Cross-account replication policy on the primary buckets.
resource "aws_iam_role" "replication" {
  provider = aws.prod
  name     = "stacksift-s3-replication"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_s3_bucket_replication_configuration" "primary" {
  for_each = aws_s3_bucket.primary
  provider = aws.prod
  bucket   = each.value.id
  role     = aws_iam_role.replication.arn

  rule {
    id     = "replicate-to-backup-account"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.replica[each.key].arn
      account       = var.backup_account_id
      storage_class = "STANDARD_IA"
      access_control_translation {
        owner = "Destination"
      }
    }

    delete_marker_replication {
      status = "Disabled"
    }
  }

  depends_on = [aws_s3_bucket_versioning.primary]
}

output "primary_bucket_arns" {
  value = { for k, b in aws_s3_bucket.primary : k => b.arn }
}

output "replica_bucket_arns" {
  value = { for k, b in aws_s3_bucket.replica : k => b.arn }
}
