import boto3
import json
import logging
import os
import pg8000

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    AWS Secrets Manager database rotation Lambda function for Aurora PostgreSQL.
    This is invoked by Secrets Manager when rotating the secret.
    """
    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    # Inicializar cliente de Secrets Manager
    service_client = boto3.client('secretsmanager')

    # Asegurarnos de que el secreto existe y está listo para la rotación
    metadata = service_client.describe_secret(SecretId=arn)
    if not metadata.get('RotationEnabled', False):
        raise ValueError(f"Secret {arn} is not enabled for rotation")
    
    versions = metadata.get('VersionIdsToStages', {})
    if token not in versions:
        raise ValueError(f"Version token {token} not associated with secret {arn}")
    
    stages = versions[token]
    if "AWSCURRENT" in stages:
        logger.info(f"Secret version {token} is already AWSCURRENT. Skipping step: {step}")
        return
    elif "AWSPENDING" not in stages:
        raise ValueError(f"Version token {token} is not AWSPENDING for secret {arn}")

    if step == "createSecret":
        create_secret(service_client, arn, token)
    elif step == "setSecret":
        set_secret(service_client, arn, token)
    elif step == "testSecret":
        test_secret(service_client, arn, token)
    elif step == "finishSecret":
        finish_secret(service_client, arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")

def create_secret(service_client, arn, token):
    """
    Create a new pending secret value.
    Reads current credentials, generates a new password, and saves it as AWSPENDING.
    """
    try:
        service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")
        logger.info(f"createSecret: AWSPENDING version {token} already exists for secret {arn}")
    except service_client.exceptions.ResourceNotFoundException:
        # Recuperar valor actual del secreto
        current_dict = json.loads(service_client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")['SecretString'])
        
        # Generar una nueva contraseña aleatoria segura
        exclude_characters = os.environ.get("EXCLUDE_CHARACTERS", '/@"\'\\')
        passwd = service_client.get_random_password(
            PasswordLength=24,
            ExcludeCharacters=exclude_characters
        )['RandomPassword']
        
        # Clonar el diccionario actual y actualizar la contraseña
        current_dict['password'] = passwd
        
        # Guardar como AWSPENDING
        service_client.put_secret_value(
            SecretId=arn,
            ClientRequestToken=token,
            SecretString=json.dumps(current_dict),
            VersionStages=['AWSPENDING']
        )
        logger.info(f"createSecret: Successfully created AWSPENDING version {token} for secret {arn}")

def get_db_connection(secret_dict):
    """
    Helper to establish connection to PostgreSQL using pg8000.
    Reads connection details from the secret dictionary.
    """
    host = secret_dict.get('host') or os.environ.get('DB_HOST')
    port = int(secret_dict.get('port') or os.environ.get('DB_PORT', 5432))
    username = secret_dict.get('username')
    password = secret_dict.get('password')
    database = secret_dict.get('dbname') or os.environ.get('DB_NAME', 'pardos')

    if not host or not username or not password:
        raise ValueError("Database host, username, and password must be present in the secret or environment variables")

    logger.info(f"Connecting to database {database} at host {host}:{port} as user {username}")
    return pg8000.connect(
        host=host,
        port=port,
        user=username,
        password=password,
        database=database,
        timeout=10
    )

def set_secret(service_client, arn, token):
    """
    Update the password in the RDS database.
    Retrieves the AWSPENDING credentials, logs into the DB using CURRENT credentials,
    and changes the password to the PENDING credentials.
    """
    # 1. Recuperar las credenciales PENDING (nueva contraseña) y CURRENT (contraseña activa)
    pending_dict = json.loads(service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")['SecretString'])
    current_dict = json.loads(service_client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")['SecretString'])

    new_password = pending_dict['password']
    username = pending_dict['username']

    # 2. Conectarse a la base de datos usando las credenciales CURRENT
    conn = None
    try:
        conn = get_db_connection(current_dict)
        cursor = conn.cursor()
        
        # 3. Alterar la contraseña en PostgreSQL
        # NOTA: Usar formateo seguro para evitar inyección SQL (los identificadores no pueden parametrizarse directamente en SQL estándar).
        # Asegurar que el username solo contenga caracteres alfanuméricos y guiones bajos.
        safe_username = "".join(c for c in username if c.isalnum() or c == "_")
        
        # Ejecutar el comando para cambiar el password
        cursor.execute(f"ALTER USER {safe_username} WITH PASSWORD %s", (new_password,))
        conn.commit()
        logger.info(f"setSecret: Password altered successfully for user {safe_username}")
        
    except Exception as e:
        logger.error(f"setSecret: Failed to update database password. Error: {e}")
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

def test_secret(service_client, arn, token):
    """
    Test connection with AWSPENDING credentials.
    Attempts to connect using the new password to confirm the change was successful.
    """
    pending_dict = json.loads(service_client.get_secret_value(SecretId=arn, VersionId=token, VersionStage="AWSPENDING")['SecretString'])

    conn = None
    try:
        conn = get_db_connection(pending_dict)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        logger.info(f"testSecret: Successful connection test. SELECT 1 returned {result}")
    except Exception as e:
        logger.error(f"testSecret: Failed connection test. Error: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def finish_secret(service_client, arn, token):
    """
    Promote AWSPENDING version to AWSCURRENT.
    """
    metadata = service_client.describe_secret(SecretId=arn)
    current_version = None
    for version, stages in metadata.get('VersionIdsToStages', {}).items():
        if "AWSCURRENT" in stages:
            if version == token:
                logger.info(f"finishSecret: Version {token} is already AWSCURRENT. Skipping promotion.")
                return
            current_version = version
            break

    # Promover AWSPENDING a AWSCURRENT y retirar la version anterior
    service_client.update_secret_version_stage(
        SecretId=arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version
    )
    logger.info(f"finishSecret: Successfully promoted version {token} to AWSCURRENT for secret {arn}")
