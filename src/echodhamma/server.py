from flask import Flask, jsonify, request
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from concurrent.futures import ThreadPoolExecutor
from echodhamma.core.sync import (
    run_sync_workflow,
    run_rss_update_workflow,
    run_chapter_alignment_workflow,
)
import os
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
import logging
from echodhamma.utils.logger import setup_logging
from echodhamma.services.minio_tracker import MinioTracker

# Configure logging for the application
setup_logging()
logger = logging.getLogger(__name__)

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
)

app = Flask(__name__)

# Single-worker executor ensures serialized execution of sync tasks
executor = ThreadPoolExecutor(max_workers=1)

_current_task = None  # Track the current running task

minio_tracker = MinioTracker()


def _run_sync():
    """Background sync task."""
    global _current_task
    try:
        logger.info("Starting scheduled sync...")
        run_chapter_alignment_workflow()
        run_sync_workflow()
        run_rss_update_workflow()
        logger.info("Scheduled sync completed.")
    except Exception as e:
        logger.error(f"Error during sync: {e}", exc_info=True)
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("task", "sync_workflow")
            sentry_sdk.capture_exception(e)
    finally:
        _current_task = None


def _run_rss_update():
    """Background RSS update task."""
    global _current_task
    try:
        logger.info("Starting RSS update...")
        run_rss_update_workflow()
        logger.info("RSS update completed.")
    except Exception as e:
        logger.error(f"Error during RSS update: {e}", exc_info=True)
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("task", "rss_update")
            sentry_sdk.capture_exception(e)
    finally:
        _current_task = None


@app.route("/sync", methods=["POST", "GET"])
def trigger_sync():
    """Triggers the podcast synchronization workflow asynchronously."""
    global _current_task
    if _current_task is not None and not _current_task.done():
        return jsonify({"status": "error", "message": "Sync already in progress"}), 429

    _current_task = executor.submit(_run_sync)

    return (
        jsonify({"status": "accepted", "message": "Sync started in background"}),
        202,
    )


@app.route("/sync/rss", methods=["POST", "GET"])
def trigger_rss_sync():
    """Triggers the RSS update workflow asynchronously."""
    global _current_task
    if _current_task is not None and not _current_task.done():
        return (
            jsonify(
                {"status": "error", "message": "Sync/RSS update already in progress"}
            ),
            429,
        )

    _current_task = executor.submit(_run_rss_update)

    return (
        jsonify({"status": "accepted", "message": "RSS update started in background"}),
        202,
    )


@app.route("/minio-event", methods=["POST"])
def handle_minio_event():
    result = minio_tracker.process_event(request.json)
    return jsonify(result), 200


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200


@app.route("/metrics", methods=["GET"])
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
