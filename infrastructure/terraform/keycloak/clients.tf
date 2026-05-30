resource "keycloak_openid_client" "frontend" {
  realm_id                     = keycloak_realm.stacksift.id
  client_id                    = "stacksift-frontend"
  enabled                      = true
  access_type                  = "PUBLIC"
  standard_flow_enabled        = true
  implicit_flow_enabled        = false
  direct_access_grants_enabled = true
  service_accounts_enabled     = false
  valid_redirect_uris          = ["${var.frontend_origin}/api/auth/callback"]
  web_origins                  = [var.frontend_origin]
  root_url                     = var.frontend_origin
  base_url                     = "/"

  pkce_code_challenge_method = "S256"
}

resource "keycloak_openid_client" "api" {
  realm_id                     = keycloak_realm.stacksift.id
  client_id                    = "stacksift-api"
  enabled                      = true
  access_type                  = "CONFIDENTIAL"
  standard_flow_enabled        = false
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = true
  valid_redirect_uris          = []
  web_origins                  = []
}

resource "keycloak_openid_client" "backend_admin" {
  realm_id                     = keycloak_realm.stacksift.id
  client_id                    = "stacksift-backend-admin"
  enabled                      = true
  access_type                  = "CONFIDENTIAL"
  service_accounts_enabled     = true
  standard_flow_enabled        = false
  direct_access_grants_enabled = false
  full_scope_allowed           = true
}

data "keycloak_openid_client" "realm_management" {
  realm_id  = keycloak_realm.stacksift.id
  client_id = "realm-management"
}

resource "keycloak_openid_client_service_account_role" "backend_admin_user_roles" {
  for_each                = toset(["manage-users", "view-users", "query-users"])
  realm_id                = keycloak_realm.stacksift.id
  service_account_user_id = keycloak_openid_client.backend_admin.service_account_user_id
  client_id               = data.keycloak_openid_client.realm_management.id
  role                    = each.value
}
