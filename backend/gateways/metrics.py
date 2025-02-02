from typing import List, Optional
from entities.metric import Metric, MetricEntry
from gateways.database.mongodb import MongoDBGateway
from datetime import datetime, UTC
from loguru import logger
from pymongo.errors import DuplicateKeyError

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
            if entry["date"] == date:
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