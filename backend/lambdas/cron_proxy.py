import http.client
import json
import os


def post(url, body):
    # Create connection
    host = url.split("//")[1].split("/")[0]
    conn = http.client.HTTPSConnection(host)

    # Make the POST request
    path = url.split(host)[1]
    headers = {"Content-Type": "application/json"}
    conn.request("POST", path, json.dumps(body), headers)

    return conn.getresponse()


def lambda_handler(event, context):
    # Extract user_whatsapp_phone_id, message, and access_token from the input event
    endpoint = event.get("endpoint")
    body = event.get("request_body")

    print(f'Triggering "{endpoint}" with body "{body}"')

    # Validate the inputs (you may want to add more robust error handling here)
    if not all([endpoint, body]):
        print("Error 400. Missing required input")
        return {"statusCode": 400, "body": "Missing required input"}

    apiurl = os.environ.get("API_URL")

    if endpoint.startswith("/"):
        endpoint = endpoint[1:]

    response = post(f"{apiurl}/{endpoint}", body)
    response_body = response.read().decode()
    print(f"Response\nStatus:{response.status}\nBody:{response_body}")

    # Parse and return the response
    return {"statusCode": response.status, "body": response.read().decode()}
