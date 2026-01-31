import logging
import os
import requests


logger = logging.getLogger(__name__)


class Notifier:
    @staticmethod
    def notify_all(feed_url):
        """
        Orchestrates pings to all configured services.
        """
        # PubSubHubbub
        hub_url = os.getenv("PUBSUBHUBBUB_HUB_URL", "https://pubsubhubbub.appspot.com")
        if hub_url:
            Notifier.ping_pubsubhubbub(hub_url, feed_url)

        # Podcast Index (using Hub PubNotify)
        # Auth not required for notifying updates, just a valid User-Agent
        podcast_index_hub_url = os.getenv(
            "PODCAST_INDEX_HUB_URL",
            "https://api.podcastindex.org/api/1.0/hub/pubnotify",
        )
        Notifier.ping_podcast_index(podcast_index_hub_url, feed_url)

    @staticmethod
    def ping_pubsubhubbub(hub_url, feed_url):
        """
        Sends a ping to a PubSubHubbub hub.
        """
        try:
            logger.info(f"Pinging PubSubHubbub hub: {hub_url} for feed: {feed_url}")
            data = {"hub.mode": "publish", "hub.url": feed_url}
            response = requests.post(hub_url, data=data, timeout=10)
            if response.status_code in [200, 202, 204]:
                logger.info(
                    f"Successfully pinged PubSubHubbub hub. Status: {response.status_code}"
                )
            else:
                logger.warning(
                    f"Failed to ping PubSubHubbub hub. Status: {response.status_code}, Response: {response.text}"
                )
        except Exception as e:
            logger.warning(f"Error pinging PubSubHubbub hub: {e}")

    @staticmethod
    def ping_podcast_index(base_url, feed_url):
        """
        Sends a ping to Podcast Index Hub PubNotify.
        No auth required, just User-Agent.
        """
        try:
            logger.info(f"Pinging Podcast Index: {base_url} for feed: {feed_url}")

            headers = {"User-Agent": "EchoDhamma/1.0"}

            # Use GET with url param as verified
            params = {"url": feed_url}
            response = requests.get(
                base_url, params=params, headers=headers, timeout=10
            )

            if response.status_code in [200, 202, 204]:
                logger.info(
                    f"Successfully pinged Podcast Index. Status: {response.status_code}"
                )
            else:
                logger.warning(
                    f"Failed to ping Podcast Index. Status: {response.status_code}, Response: {response.text}"
                )
        except Exception as e:
            logger.warning(f"Error pinging Podcast Index: {e}")
