import base64
import gzip
import json
import os
import urllib3

http = urllib3.PoolManager()

def lambda_handler(event, context):
    loki_url = os.environ.get("LOKI_URL", "http://loki.pardos.local:3100/loki/api/v1/push")
    env = os.environ.get("ENVIRONMENT", "dev")

    # Decodificar y descomprimir logs de CloudWatch
    cw_data = event['awslogs']['data']
    compressed_payload = base64.b64decode(cw_data)
    uncompressed_payload = gzip.decompress(compressed_payload)
    log_data = json.loads(uncompressed_payload)

    log_group = log_data.get('logGroup', 'unknown')
    log_stream = log_data.get('logStream', 'unknown')

    # Intentar deducir el nombre del servicio a partir del log group
    service = "unknown"
    if "/" in log_group:
        service = log_group.split("/")[-1]

    streams = []
    values = []

    for log_event in log_data.get('logEvents', []):
        timestamp_ms = log_event.get('timestamp')
        timestamp_ns = str(timestamp_ms * 1000000)
        message = log_event.get('message', '').strip()
        values.append([timestamp_ns, message])

    if values:
        streams.append({
            "stream": {
                "env": env,
                "service": service,
                "log_group": log_group,
                "log_stream": log_stream,
                "source": "cloudwatch"
            },
            "values": values
        })

    payload = {"streams": streams}
    headers = {'Content-Type': 'application/json'}
    encoded_data = json.dumps(payload).encode('utf-8')

    try:
        res = http.request('POST', loki_url, body=encoded_data, headers=headers, timeout=5.0)
        print(f"Sent logs to Loki. Status: {res.status}, Response: {res.data.decode('utf-8')}")
    except Exception as e:
        print(f"Error sending logs to Loki: {str(e)}")
        raise e

    return {
        'statusCode': 200,
        'body': json.dumps('Logs processed successfully')
    }
