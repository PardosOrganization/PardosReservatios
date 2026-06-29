#####################################################################
# API GATEWAY DE FAILOVER EN us-west-2
#####################################################################

resource "aws_cloudwatch_log_group" "dr_api_gw" {
  count             = var.enable_dr_region ? 1 : 0
  provider          = aws.us_west_2
  name              = "/aws/vendedlogs/apigateway/${local.name}-dr-api-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.replica.arn   # CKV_AWS_158: CMK us-west-2, política AllowCloudWatchLogsDR
}

resource "aws_apigatewayv2_vpc_link" "dr" {
  count              = var.enable_dr_region ? 1 : 0
  provider           = aws.us_west_2
  name               = "${local.name}-dr-vpclink"
  subnet_ids         = aws_subnet.dr_public[*].id
  security_group_ids = [aws_security_group.dr_alb[0].id]
}

resource "aws_apigatewayv2_api" "dr" {
  count         = var.enable_dr_region ? 1 : 0
  provider      = aws.us_west_2
  name          = "${local.name}-dr-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "dr" {
  count              = var.enable_dr_region ? 1 : 0
  provider           = aws.us_west_2
  api_id             = aws_apigatewayv2_api.dr[0].id
  integration_type   = "HTTP_PROXY"
  integration_uri    = aws_lb_listener.dr_http[0].arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.dr[0].id
}

resource "aws_apigatewayv2_route" "dr" {
  count              = var.enable_dr_region ? 1 : 0
  provider           = aws.us_west_2
  api_id             = aws_apigatewayv2_api.dr[0].id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.dr[0].id}"
  authorization_type = "AWS_IAM"
}


resource "aws_apigatewayv2_stage" "dr" {
  count       = var.enable_dr_region ? 1 : 0
  provider    = aws.us_west_2
  api_id      = aws_apigatewayv2_api.dr[0].id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.dr_api_gw[0].arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
}
