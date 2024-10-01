import json
import uuid
from botocore.exceptions import ClientError
import boto3
from constants import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class CronJobTarget(BaseModel):
    Arn: str
    Id: str
    Input: str


class CronJobDetails(BaseModel):
    id: str
    schedule: str
    state: str
    description: str
    arn: str
    targets: List[CronJobTarget]


class EventBridgeCronGateway:
    def __init__(self):
        self.client = boto3.client(
            "events",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

    def get(self, cron_id: str) -> Optional[CronJobDetails]:
        try:
            response = self.client.describe_rule(Name=cron_id)
            targets = self.client.list_targets_by_rule(Rule=cron_id)

            return CronJobDetails(
                id=cron_id,
                schedule=response.get("ScheduleExpression", ""),
                state=response.get("State", ""),
                description=response.get("Description", ""),
                arn=response.get("Arn", ""),
                targets=[CronJobTarget(**t) for t in targets.get("Targets", [])],
            )
        except ClientError as err:
            if err.response["Error"]["Code"] == "ResourceNotFoundException":
                return None
            else:
                raise err

    def create(self, aws_cron_string: str, target: str, payload: dict) -> str:
        cron_id = str(uuid.uuid4())
        if "cron(" not in aws_cron_string:
            aws_cron_string = f"cron({aws_cron_string})"
        self.client.put_rule(
            Name=cron_id,
            ScheduleExpression=aws_cron_string,
            State="ENABLED",
            Description=f"Task created by Tracking Software on {datetime.now().isoformat()}.",
        )

        self.client.put_targets(
            Rule=cron_id,
            Targets=[
                {
                    "Arn": target,
                    "Id": f"tracking-software-backend-lambda",
                    "Input": json.dumps(payload),
                },
            ],
        )
        return cron_id

    def update(
        self, cron_id: str, aws_cron_string: str, targets: List[CronJobTarget]
    ) -> str:
        if "cron(" not in aws_cron_string:
            aws_cron_string = f"cron({aws_cron_string})"
        self.client.put_rule(
            Name=cron_id,
            ScheduleExpression=aws_cron_string,
            State="ENABLED",
            Description=f"Task created by Tracking Software on {datetime.now().isoformat()}.",
        )

        self.client.put_targets(
            Rule=cron_id,
            Targets=[t.dict() for t in targets],
        )
        return cron_id

    def delete(self, cronjob_id: str):
        try:
            self.client.remove_targets(
                Rule=cronjob_id, Ids=["tracking-software-backend-lambda"]
            )
            self.client.delete_rule(Name=cronjob_id)
        except ClientError as err:
            if err.response["Error"]["Code"] == "ResourceNotFoundException":
                pass
            else:
                raise err

    def validate(self, aws_cron_str: str) -> bool:
        from aws_cron_expression_validator.validator import AWSCronExpressionValidator

        try:
            if aws_cron_str.startswith("cron(") and aws_cron_str.endswith(")"):
                aws_cron_str = aws_cron_str[5:-1]

            AWSCronExpressionValidator.validate(aws_cron_str)
            return True
        except ValueError:
            return False

    def get_validation_error(self, aws_cron_str: str) -> str:
        from aws_cron_expression_validator.validator import AWSCronExpressionValidator

        try:
            if aws_cron_str.startswith("cron(") and aws_cron_str.endswith(")"):
                aws_cron_str = aws_cron_str[5:-1]

            AWSCronExpressionValidator.validate(aws_cron_str)
            return ""
        except ValueError as e:
            return str(e)
