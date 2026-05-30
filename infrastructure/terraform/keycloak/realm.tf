resource "keycloak_realm" "stacksift" {
  realm             = "stacksift"
  enabled           = true
  display_name      = "StackSift"
  display_name_html = "<b>StackSift</b>"

  access_token_lifespan        = "15m"
  sso_session_idle_timeout     = "30m"
  sso_session_max_lifespan     = "12h"
  offline_session_idle_timeout = "30d"
  revoke_refresh_token         = true
  refresh_token_max_reuse      = 0

  registration_allowed           = false
  registration_email_as_username = true
  remember_me                    = false
  verify_email                   = true
  login_with_email_allowed       = true
  duplicate_emails_allowed       = false
  reset_password_allowed         = true
  edit_username_allowed          = false

  ssl_required = "all"

  # Matches the backend RegisterUserCommandValidator (12 + upper + lower + digit).
  # specialChars/forceExpire/argon2 are intentionally omitted until the validator
  # is aligned, otherwise app-driven registration fails Keycloak policy.
  password_policy = "length(12) and digits(1) and lowerCase(1) and upperCase(1) and notUsername and notEmail and passwordHistory(3)"

  security_defenses {
    brute_force_detection {
      permanent_lockout                = false
      max_login_failures               = 10
      wait_increment_seconds           = 60
      quick_login_check_milli_seconds  = 1000
      minimum_quick_login_wait_seconds = 60
      max_failure_wait_seconds         = 900
      failure_reset_time_seconds       = 43200
    }
  }

  internationalization {
    supported_locales = ["en"]
    default_locale    = "en"
  }

  dynamic "smtp_server" {
    for_each = var.smtp_host == "" ? [] : [1]
    content {
      host              = var.smtp_host
      port              = tostring(var.smtp_port)
      from              = var.smtp_from
      from_display_name = "StackSift"
      reply_to          = var.smtp_from
      starttls          = true
      ssl               = false

      auth {
        username = var.smtp_user
        password = var.smtp_password
      }
    }
  }
}

resource "keycloak_required_action" "verify_email" {
  realm_id       = keycloak_realm.stacksift.id
  alias          = "VERIFY_EMAIL"
  name           = "Verify Email"
  enabled        = true
  default_action = true
  priority       = 50
}

resource "keycloak_required_action" "configure_totp" {
  realm_id       = keycloak_realm.stacksift.id
  alias          = "CONFIGURE_TOTP"
  name           = "Configure OTP"
  enabled        = true
  default_action = false
  priority       = 60
}

resource "keycloak_realm_events" "stacksift" {
  realm_id = keycloak_realm.stacksift.id

  events_enabled               = true
  events_expiration            = 2592000
  admin_events_enabled         = true
  admin_events_details_enabled = true
  events_listeners             = ["jboss-logging"]

  enabled_event_types = [
    "LOGIN", "LOGIN_ERROR",
    "REGISTER", "REGISTER_ERROR",
    "LOGOUT", "LOGOUT_ERROR",
    "CODE_TO_TOKEN", "CODE_TO_TOKEN_ERROR",
    "REFRESH_TOKEN", "REFRESH_TOKEN_ERROR",
    "UPDATE_PASSWORD", "UPDATE_PASSWORD_ERROR",
    "RESET_PASSWORD", "RESET_PASSWORD_ERROR",
    "VERIFY_EMAIL", "VERIFY_EMAIL_ERROR",
    "REMOVE_TOTP", "UPDATE_TOTP",
    "USER_DELETE_ACCOUNT", "USER_DELETE_ACCOUNT_ERROR",
    "CLIENT_LOGIN", "CLIENT_LOGIN_ERROR",
  ]
}
