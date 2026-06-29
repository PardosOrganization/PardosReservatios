resource "aws_sqs_queue" "reservas_dlq" {
  name                        = "${local.name}-reservas-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = aws_kms_key.this.arn
  tags = {
    Name        = "${local.name}-reservas-dlq"
    Environment = terraform.workspace
  }
}

resource "aws_sqs_queue" "reservas" {
  name                        = "${local.name}-reservas-fifo.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = aws_kms_key.this.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.reservas_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name        = "${local.name}-reservas-fifo"
    Environment = terraform.workspace
  }
}
