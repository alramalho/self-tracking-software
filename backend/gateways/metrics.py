from typing import List, Optional
from entities.metric import Metric, MetricEntry
from gateways.database.mongodb import MongoDBGateway
from datetime import datetime, timedelta, date, UTC
from loguru import logger
from pymongo.errors import DuplicateKeyError
from shared.utils import days_ago
from typing import Tuple

class MetricDoesNotExistException(Exception):
    pass

class MetricAlreadyExistsException(Exception):
    pass

class MetricEntryDoesNotExistException(Exception):
    pass

class MetricEntryAlreadyExistsException(Exception):
    pass

class MetricsGateway:
    def __init__(self):
        self.metrics_db_gateway = MongoDBGateway("metrics")
        self.metric_entries_db_gateway = MongoDBGateway("metric_entries")

    def get_metric_by_id(self, metric_id: str) -> Optional[Metric]:
        data = self.metrics_db_gateway.query("id", metric_id)
        if len(data) > 0:
            return Metric(**data[0])
        return None

    def get_all_metrics_by_user_id(self, user_id: str) -> List[Metric]:
        return [Metric(**data) for data in self.metrics_db_gateway.query("user_id", user_id)]

    def create_metric(self, metric: Metric) -> Metric:
        if len(self.metrics_db_gateway.query("id", metric.id)) != 0:
            logger.info(f"Metric {metric.id} ({metric.title}) already exists")
            raise MetricAlreadyExistsException()
        try:
            self.metrics_db_gateway.write(metric.dict())
            logger.info(f"Metric {metric.id} ({metric.title}) created")
            return metric
        except DuplicateKeyError:
            logger.error(f"Error creating metric: Metric {metric.id} ({metric.title}) already exists")
            raise
        except Exception as e:
            logger.error(f"Error creating metric: {e}")
            raise

    def delete_metric(self, metric_id: str):
        metric = self.get_metric_by_id(metric_id)
        if not metric:
            raise MetricDoesNotExistException()
        metric.deleted_at = datetime.now(UTC).isoformat()
        self.metrics_db_gateway.write(metric.dict())
        logger.info(f"Metric {metric.id} ({metric.title}) marked as deleted")

    def get_metric_entry_by_id(self, entry_id: str) -> Optional[MetricEntry]:
        data = self.metric_entries_db_gateway.query("id", entry_id)
        if len(data) > 0:
            return MetricEntry(**data[0])
        return None

    def get_metric_entry_by_metric_and_date(self, metric_id: str, date: str) -> Optional[MetricEntry]:
        entries = self.metric_entries_db_gateway.query("metric_id", metric_id)
        for entry in entries:
            if datetime.fromisoformat(entry["date"]).date() == datetime.fromisoformat(date).date():
                return MetricEntry(**entry)
        return None

    def get_metric_entries_by_metric_id(self, metric_id: str) -> List[MetricEntry]:
        return [MetricEntry(**data) for data in self.metric_entries_db_gateway.query("metric_id", metric_id)]

    def get_all_metric_entries_by_user_id(self, user_id: str) -> List[MetricEntry]:
        return [MetricEntry(**data) for data in self.metric_entries_db_gateway.query("user_id", user_id)]

    def create_metric_entry(self, entry: MetricEntry) -> MetricEntry:
        metric = self.get_metric_by_id(entry.metric_id)
        if not metric:
            raise MetricDoesNotExistException(f"Metric with id {entry.metric_id} does not exist")

        existing_entry = self.get_metric_entry_by_metric_and_date(entry.metric_id, entry.date)
        if existing_entry:
            raise MetricEntryAlreadyExistsException(
                f"MetricEntry for metric {metric.title} on date {entry.date} already exists"
            )

        try:
            self.metric_entries_db_gateway.write(entry.dict())
            logger.info(f"MetricEntry ({metric.title} for date {entry.date}) created")
            return entry
        except Exception as e:
            logger.error(f"Error creating metric entry: {e}")
            raise

    def update_metric_entry(self, entry_id: str, updates: dict) -> MetricEntry:
        entry = self.get_metric_entry_by_id(entry_id)
        if not entry:
            logger.info(f"MetricEntry {entry_id} does not exist")
            raise MetricEntryDoesNotExistException()
        
        for key, value in updates.items():
            setattr(entry, key, value)
        self.metric_entries_db_gateway.write(entry.dict())
        logger.info(f"MetricEntry {entry_id} updated")
        return entry

    def delete_metric_entry(self, entry_id: str):
        entry = self.get_metric_entry_by_id(entry_id)
        if not entry:
            raise MetricEntryDoesNotExistException()
        entry.deleted_at = datetime.now(UTC).isoformat()
        self.metric_entries_db_gateway.write(entry.dict())
        logger.info(f"MetricEntry {entry_id} marked as deleted")

    def get_readable_metric_entry(self, metric_entry: MetricEntry, metric: Optional[Metric] = None) -> str:
        if metric is None:
            metric = self.get_metric_by_id(metric_entry.metric_id)
            
        formatted_date = datetime.fromisoformat(metric_entry.date).strftime("%A, %b %d %Y")
        metric_title = metric.title
        metric_rating = metric_entry.rating
        
        return f"{formatted_date} ({days_ago(metric_entry.date)}) - {metric_title} ({metric_rating}/5)"


    def get_readable_metrics_and_entries(self, user_id: str, lookback_days: int = 7) -> str:
        metrics_list = self.get_all_metrics_by_user_id(user_id)
        metric_entries = self.get_all_metric_entries_by_user_id(user_id)

        if len(metric_entries) == 0:
            return f"The user submitted no metrics in the last {lookback_days} days"

        # Build the output string
        output = []

        # Summary
        metric_titles = [metric.title for metric in metrics_list]
        output.append(f"- The user has created {len(metrics_list)} metrics ({', '.join(metric_titles)})")
        output.append(f"- Here are the logged metric entries of the past {lookback_days} days")
        output.append("  (When available, user's responses to 'Anything specific that influenced your ratings today?' are shown in parentheses)")

        # Create mapping from metric id to title
        metric_by_id = {metric.id: metric.title for metric in metrics_list}
        today = date.today()

        for i in range(lookback_days):
            target_day = today - timedelta(days=i)
            if i == 0:
                day_label = f"Today, {datetime.now(UTC).strftime('%A, %b %d %Y')}"
            elif i == 1:
                day_label = f"Yesterday, {datetime.now(UTC).strftime('%A, %b %d %Y')}"
            else:
                day_label = f"{i} days ago, {datetime.now(UTC).strftime('%A, %b %d %Y')}"

            day_entries = []
            for entry in metric_entries:
                try:
                    entry_date = datetime.fromisoformat(entry.date).date()
                except Exception:
                    continue
                if entry_date == target_day:
                    entry_text = f"{metric_by_id.get(entry.metric_id, 'Unknown')} {entry.rating}/5"
                    if entry.description:
                        entry_text += f" (User's note: {entry.description})"
                    day_entries.append(entry_text)
            if day_entries:
                output.append(f"  - {day_label}: {', '.join(day_entries)}")
            else:
                output.append(f"  - {day_label}: No reports")
        
        return "\n".join(output)
    
    def get_missing_metric_and_entries_today_by_user_id(self, user_id: str) -> Tuple[List[Metric], List[MetricEntry]]:
        metrics = self.get_all_metrics_by_user_id(user_id)
        missing_metrics_today = []
        missing_metric_entries_today = []
        for metric in metrics:
            entry = self.get_metric_entry_by_metric_and_date(metric.id, datetime.now(UTC).isoformat())
            if not entry:
                missing_metrics_today.append(metric)
                missing_metric_entries_today.append(entry)
        return missing_metrics_today, missing_metric_entries_today
