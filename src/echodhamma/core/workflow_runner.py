import os
import logging
import sentry_sdk
from echodhamma.utils.title_matcher import load_thero_data

logger = logging.getLogger(__name__)


class WorkflowRunner:
    @staticmethod
    def run_for_all_theros(action_callback, action_name="Task"):
        """
        Iterates over all thero config files and executes the callback.
        action_callback: function that takes the config dict as an argument.
        """
        theros_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "theros")

        if not os.path.exists(theros_dir):
            logger.error(f"Theros directory not found: {theros_dir}")
            return

        for filename in os.listdir(theros_dir):
            if filename.endswith(".json") and "_thero" in filename:
                try:
                    config = load_thero_data(os.path.join(theros_dir, filename))
                    if not config.get("enabled", True):
                        logger.info(f"Skipping {filename}: Disabled in config.")
                        continue

                    action_callback(config)

                except Exception as e:
                    logger.error(
                        f"Error executing {action_name} for {filename}: {e}",
                        exc_info=True,
                    )
                    with sentry_sdk.new_scope() as scope:
                        scope.set_tag("thero_config", filename)
                        scope.set_tag("action", action_name)
                        sentry_sdk.capture_exception(e)


# Compatibility wrappers for the old functions if needed,
# or we can define them in the main entry point.
