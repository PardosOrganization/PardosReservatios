resource "aws_cognito_user_pool" "this" {
  name = "${local.name}-empleados"

  password_policy {
    minimum_length    = 10
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  tags = {
    Name        = "${local.name}-empleados"
    Environment = terraform.workspace
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name                = "${local.name}-empleados-spa"
  user_pool_id        = aws_cognito_user_pool.this.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}
