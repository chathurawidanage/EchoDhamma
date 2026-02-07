import boto3
import json
import os
import logging
from botocore.exceptions import ClientError
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

MAX_CONCURRENCY = min(32, (os.cpu_count() or 1) * 5)


class S3Manager:
    def __init__(self, endpoint, bucket, access_key, secret_key):
        self.logger = logging.getLogger(__name__)
        self.bucket = bucket
        self.endpoint = endpoint
        # Use a more robust config for proxied S3 backends
        self.transfer_config = TransferConfig(
            multipart_threshold=100 * 1024 * 1024,  # 100MB threshold
            multipart_chunksize=100 * 1024 * 1024,  # 100MB chunks
            max_concurrency=10,
            use_threads=True,
        )
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(max_pool_connections=MAX_CONCURRENCY),
        )

    @property
    def max_concurrency(self):
        return self.transfer_config.max_concurrency

    def file_exists(self, key):
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    def upload_file(self, local_path, key, content_type):
        self.client.upload_file(
            local_path,
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type},
            Config=self.transfer_config,
        )

    def get_json(self, key):
        try:
            resp = self.client.get_object(Bucket=self.bucket, Key=key)
            return json.loads(resp["Body"].read().decode("utf-8"))
        except ClientError as e:
            error_code = str(e.response.get("Error", {}).get("Code", "")).lower()
            if error_code in ["nosuchkey", "404", "not found"]:
                return None
            raise
        except json.JSONDecodeError as e:
            self.logger.warning(f"Warning: Invalid JSON in {key}: {e}")
        return None

    def list_metadata_files(self):
        paginator = self.client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket)
        return [
            obj["Key"]
            for page in pages
            if "Contents" in page
            for obj in page["Contents"]
            if obj["Key"].endswith(".json") and obj["Key"] != "sync_state.json"
        ]

    def load_state(self, state_file):
        try:
            state = self.get_json(state_file)
            # get_json returns None for missing files or invalid JSON
            return state if state is not None else {}
        except ClientError:
            return {}

    def save_state(self, state_file, state):
        self.save_json(state_file, state)

    def save_metadata(self, metadata):
        vid_id = metadata["id"]
        meta_file = f"{vid_id}.json"
        self.save_json(meta_file, metadata)

    def save_json(self, key, data):
        """Generic method to save JSON data to S3."""
        local_temp = f"temp_{key.replace('/', '_')}"
        with open(local_temp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        self.upload_file(local_temp, key, "application/json")
        if os.path.exists(local_temp):
            os.remove(local_temp)

    def download_file(self, key, local_path):
        try:
            self.client.download_file(self.bucket, key, local_path)
        except ClientError as e:
            self.logger.error(f"Error downloading {key}: {e}")
            raise
