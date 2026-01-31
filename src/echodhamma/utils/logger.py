import logging
import sys


def setup_logging(level=logging.INFO):
    """
    Configures the root logger to output to stdout with a standard format.
    """
    logging.basicConfig(
        level=level,
        stream=sys.stdout,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True,  # Overwrite any existing configuration
    )
