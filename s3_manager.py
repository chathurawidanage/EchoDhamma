import boto3
import json
import os
from botocore.exceptions import ClientError
from boto3.s3.transfer import TransferConfig


class S3Manager:
    def __init__(self, endpoint, bucket, access_key, secret_key):
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
        )

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
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise
        except json.JSONDecodeError as e:
            print(f"Warning: Invalid JSON in {key}: {e}")
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
        local_temp = f"temp_{state_file}"
        with open(local_temp, "w") as f:
            json.dump(state, f)
        self.upload_file(local_temp, state_file, "application/json")
        if os.path.exists(local_temp):
            os.remove(local_temp)

    def save_metadata(self, metadata):
        vid_id = metadata["id"]
        meta_file = f"{vid_id}.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        self.upload_file(meta_file, meta_file, "application/json")
        if os.path.exists(meta_file):
            os.remove(meta_file)
