from flask import Flask, jsonify
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from concurrent.futures import ThreadPoolExecutor
from sync import run_sync_workflow, run_rss_update_workflow
import os

app = Flask(__name__)

# Single-worker executor ensures serialized execution of sync tasks
# This prevents race conditions on shared state and temporary files
executor = ThreadPoolExecutor(max_workers=1)
_current_task = None  # Track the current running task


def _run_sync():
    """Background sync task."""
    global _current_task
    try:
        print("Starting scheduled sync...")
        run_sync_workflow()
        print("Scheduled sync completed.")
    except Exception as e:
        print(f"Error during sync: {e}")
    finally:
        _current_task = None


def _run_rss_update():
    """Background RSS update task."""
    global _current_task
    try:
        print("Starting RSS update...")
        run_rss_update_workflow()
        print("RSS update completed.")
    except Exception as e:
        print(f"Error during RSS update: {e}")
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


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200


@app.route("/metrics", methods=["GET"])
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
