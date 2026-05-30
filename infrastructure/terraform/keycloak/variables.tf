variable "kc_bootstrap_admin" {
  type      = string
  sensitive = true
}

variable "kc_bootstrap_password" {
  type      = string
  sensitive = true
}

variable "kc_base_url" {
  type = string
}

variable "frontend_origin" {
  type = string
}

variable "smtp_host" {
  type    = string
  default = ""
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "smtp_user" {
  type      = string
  default   = ""
  sensitive = true
}

variable "smtp_password" {
  type      = string
  default   = ""
  sensitive = true
}

variable "smtp_from" {
  type    = string
  default = "no-reply@stacksift.com"
}
