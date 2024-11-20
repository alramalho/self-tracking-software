from datetime import UTC, datetime, timedelta, timezone

def time_ago(iso_str):
    if (
        " ago" in iso_str.lower()
        or "just now" in iso_str.lower()
        or "never" in iso_str.lower()
    ):
        # is already converted
        return iso_str
    if iso_str is None or iso_str == "":
        return "Never"

    # Parse the ISO string to a datetime object
    iso_str = iso_str.replace("Z", "+00:00")  # Replace 'Z' with '+00:00'
    dt = datetime.fromisoformat(iso_str)

    # If dt is naive, set its timezone to UTC.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    delta = now - dt

    # Calculate the time difference in various units
    seconds = delta.total_seconds()
    minutes = seconds // 60
    hours = minutes // 60
    days = hours // 24

    if days > 0:
        # If the difference is more than 72 hours, return in "Y days ago" format.
        return f"{int(days)} days ago"
    elif hours > 0:
        # If the difference is less than 72 hours but more than 1 hour, return in "X hours ago" format.
        return f"{int(hours)} hours ago"
    elif minutes > 0:
        # If the difference is less than 1 hour but more than 1 minute, return in "X minutes ago" format.
        return f"{int(minutes)} minutes ago"
    else:
        # If the difference is less than 1 minute, return "Just now" format.
        return "Just now"


def exclude_embedding_fields(d: dict):
    return {key: value for key, value in d.items() if not key.endswith("_embedding")}



if __name__ == "__main__":
    print(time_ago("2024-11-12T17:03:00.000Z"))