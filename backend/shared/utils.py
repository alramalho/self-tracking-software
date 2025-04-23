from datetime import UTC, datetime, timedelta, timezone


def is_hours_old(iso_str: str, hours: int) -> bool:
    if iso_str is None or iso_str == "":
        return False
    iso_str = iso_str.replace("Z", "+00:00")  # Replace 'Z' with '+00:00'
    dt = datetime.fromisoformat(iso_str)
    # Ensure dt has timezone info
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return (datetime.now(UTC) - dt).total_seconds() > hours * 3600

def _dict_to_markdown(data: dict, indent: int = 0) -> str:
    """Convert a dictionary to a readable markdown format."""
    result = []
    for key, value in data.items():
        prefix = "  " * indent
        if isinstance(value, dict):
            result.append(f"{prefix}{key}:")
            result.append(_dict_to_markdown(value, indent + 1))
        else:
            result.append(f"{prefix}{key}: {value}")
    return "\n".join(result)


def count_weeks_between_dates(start_date: datetime, end_date: datetime) -> int:
    return (end_date - start_date).days // 7

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

def days_ago(iso_str):
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

    days = delta.days

    if days <= 0:
        return "today"
    elif days == 1:
        return "yesterday"
    else:
        return f"{days} days ago"

def exclude_embedding_fields(d: dict):
    return {key: value for key, value in d.items() if not key.endswith("_embedding")}

if __name__ == "__main__":
    print(time_ago("2024-11-12T17:03:00.000Z"))
    print(days_ago("2024-11-12T17:03:00.000Z"))