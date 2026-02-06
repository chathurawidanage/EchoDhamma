import datetime
import email.utils


def get_pub_date(info):
    """
    Extracts and formats publication date from video info.
    Returns an RFC 2822 date string.
    """
    upload_timestamp = info.get("timestamp")
    if upload_timestamp:
        return email.utils.formatdate(upload_timestamp, usegmt=True)
    elif info.get("upload_date"):
        try:
            dt = datetime.datetime.strptime(info["upload_date"], "%Y%m%d")
            dt = dt.replace(tzinfo=datetime.timezone.utc)
            return email.utils.format_datetime(dt)
        except ValueError:
            pass
    return email.utils.formatdate(usegmt=True)


def parse_time_to_seconds(time_str):
    """Converts HH:MM:SS string to seconds (float)."""
    try:
        parts = list(map(int, time_str.split(":")))
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        elif len(parts) == 2:
            return parts[0] * 60 + parts[1]
        else:
            return 0
    except ValueError:
        return 0


def get_safe_pub_date(x):
    """
    Parses pub_date from metadata dict, ensuring timezone info.
    Useful for sorting.
    """
    try:
        dt = email.utils.parsedate_to_datetime(x.get("pub_date", ""))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except Exception:
        return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)
