from entities.mood_report import MoodReport
from gateways.database.mongodb import MongoDBGateway
from loguru import logger

class MoodReportDoesNotExistException(Exception):
    pass

class MoodReportAlreadyExistsException(Exception):
    pass

class MoodsGateway:
    def __init__(self):
        self.mood_reports_db_gateway = MongoDBGateway("mood_reports")

    def get_mood_report_by_id(self, mood_report_id: str) -> MoodReport:
        data = self.mood_reports_db_gateway.query("id", mood_report_id)
        if len(data) > 0:
            return MoodReport(**data[0])
        else:
            return None

    def get_all_mood_reports_by_user_id(self, user_id: str) -> list[MoodReport]:
        return [MoodReport(**data) for data in self.mood_reports_db_gateway.query("user_id", user_id)]

    def create_mood_report(self, mood_report: MoodReport) -> MoodReport:
        if len(self.mood_reports_db_gateway.query("id", mood_report.id)) != 0:
            logger.info(f"MoodReport {mood_report.id} for date {mood_report.date} already exists")
            raise MoodReportAlreadyExistsException()
        self.mood_reports_db_gateway.write(mood_report.dict())
        logger.info(f"MoodReport {mood_report.id} for date {mood_report.date} created")
        return mood_report

    def delete_mood_report(self, mood_report_id: str):
        mood_report = self.get_mood_report_by_id(mood_report_id)
        if mood_report is None:
            raise MoodReportDoesNotExistException()
        self.mood_reports_db_gateway.delete("id", mood_report_id)
        logger.info(f"MoodReport {mood_report_id} deleted")
