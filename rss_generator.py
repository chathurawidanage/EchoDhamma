import re
import xml.etree.ElementTree as ET
from xml.sax.saxutils import unescape


class RSSGenerator:
    @staticmethod
    def generate(config, items, base_url, local_filename):
        podcast_config = config["podcast"]
        ET.register_namespace("itunes", "http://www.itunes.com/dtds/podcast-1.0.dtd")

        root = ET.Element("rss", version="2.0")
        channel = ET.SubElement(root, "channel")

        def add_tag(parent, tag, text=None, attrib=None):
            el = ET.SubElement(parent, tag, attrib or {})
            if text is not None:
                el.text = text
            return el

        add_tag(channel, "title", podcast_config["title"])
        add_tag(channel, "description", podcast_config["description"])
        add_tag(channel, "link", podcast_config["link"])
        add_tag(channel, "language", podcast_config["language"])
        add_tag(
            channel,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}author",
            podcast_config["author"],
        )
        add_tag(
            channel,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}explicit",
            podcast_config["explicit"],
        )

        owner = add_tag(channel, "{http://www.itunes.com/dtds/podcast-1.0.dtd}owner")
        add_tag(
            owner,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}name",
            podcast_config["author"],
        )
        add_tag(
            owner,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}email",
            podcast_config["email"],
        )

        cat = add_tag(
            channel,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}category",
            attrib={"text": podcast_config["category"]},
        )
        if podcast_config.get("subcategory"):
            add_tag(
                cat,
                "{http://www.itunes.com/dtds/podcast-1.0.dtd}category",
                attrib={"text": podcast_config["subcategory"]},
            )

        img_url = podcast_config["image_url"]
        if not img_url.startswith("http"):
            img_url = f"{base_url}/{img_url}"
        add_tag(
            channel,
            "{http://www.itunes.com/dtds/podcast-1.0.dtd}image",
            attrib={"href": img_url},
        )

        for item in items:
            audio_url = item.get("s3_audio_url") or item.get("url")
            if not audio_url:
                continue
            rss_item = add_tag(channel, "item")
            # Use AI-generated title if available, otherwise fall back to original
            ai_response = item.get("ai_response") or {}
            title = ai_response.get("title") or item.get("title", "No Title")
            add_tag(rss_item, "title", title)

            desc = item.get("description", "")
            add_tag(rss_item, "description", f"%%CDATA_START%%{desc}%%CDATA_END%%")

            add_tag(
                rss_item,
                "enclosure",
                attrib={
                    "url": audio_url,
                    "type": "audio/mpeg",
                    "length": str(item.get("length_bytes", 0)),
                },
            )
            add_tag(
                rss_item,
                "guid",
                text=item.get("id", audio_url),
                attrib={"isPermaLink": "false"},
            )
            add_tag(rss_item, "pubDate", item.get("pub_date", ""))

            duration = int(item.get("duration", 0))
            m, s = divmod(duration, 60)
            h, m = divmod(m, 60)
            dur_str = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"
            add_tag(
                rss_item,
                "{http://www.itunes.com/dtds/podcast-1.0.dtd}duration",
                dur_str,
            )
            add_tag(
                rss_item, "{http://www.itunes.com/dtds/podcast-1.0.dtd}explicit", "no"
            )

            if item.get("image_url"):
                add_tag(
                    rss_item,
                    "{http://www.itunes.com/dtds/podcast-1.0.dtd}image",
                    attrib={"href": item["image_url"]},
                )

        tree = ET.ElementTree(root)
        tree.write(local_filename, encoding="UTF-8", xml_declaration=True)

        with open(local_filename, "r", encoding="UTF-8") as f:
            content = f.read()

        # Unescape only the content inside CDATA markers, then replace the markers

        def unescape_cdata(match):
            inner = match.group(1)
            # Unescape HTML entities inside CDATA
            unescaped = unescape(inner, {"&quot;": '"', "&apos;": "'"})
            return f"<![CDATA[{unescaped}]]>"

        content = re.sub(
            r"%%CDATA_START%%(.*?)%%CDATA_END%%",
            unescape_cdata,
            content,
            flags=re.DOTALL,
        )

        with open(local_filename, "w", encoding="UTF-8") as f:
            f.write(content)
