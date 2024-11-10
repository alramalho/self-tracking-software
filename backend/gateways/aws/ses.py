from botocore.exceptions import ClientError
from shared.logger import logger
from constants import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
import boto3
import os

def get_email_template_string(header: str, content: str) -> str:
    abs_path = os.path.abspath(__file__)
    file_dir_path = abs_path.replace(f"/{os.path.basename(abs_path)}", "").replace(
        os.getcwd(), ""
    )
    html_path = f"{file_dir_path}/../../emails/template.html"

    if html_path[0] == "/":
        html_path = html_path[1:]

    with open(html_path, "r") as file:
        result = file.read()
        result = result.replace("{{header}}", header)
        result = result.replace("{{content}}", content)
        return result


class SESGateway:
    def __init__(self):
        self.ses_client = boto3.client(
            "ses",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name="eu-central-1",
        )

    def send_email(self, to: str, subject: str, html_body: str):
        try:
            self.ses_client.send_email(
                Source="Alex from Tracking.So 🌱 <contact@thinking.so>",
                Destination={"ToAddresses": [to]},
                Message={
                    "Subject": {
                        "Charset": "UTF-8",
                        "Data": subject,
                    },
                    "Body": {"Html": {"Charset": "UTF-8", "Data": html_body}},
                },
            )
            logger.info(f"Email sent to {to}")
        except ClientError as e:
            logger.error(f"Error sending email to {to}: {e}")
            raise e
