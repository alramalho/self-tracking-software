from datetime import datetime, UTC

from botocore.exceptions import ClientError
from gateways.database.base import DBGateway
from loguru import logger
from constants import ENVIRONMENT, SNAKE_CASE_PREFIX
import boto3
from typing import Dict, Any, List, Optional, Union
from decimal import Decimal


def _convert_decimals_to_floats(item: Any) -> Any:
    if isinstance(item, list):
        return [_convert_decimals_to_floats(i) for i in item]
    elif isinstance(item, dict):
        return {
            k: _convert_decimals_to_floats(v) for k, v in item.items()
        }
    elif isinstance(item, Decimal):
        return float(item)
    else:
        return item


def _convert_floats_to_decimals(item: Any) -> Any:
    if isinstance(item, list):
        return [_convert_floats_to_decimals(i) for i in item]
    elif isinstance(item, dict):
        return {
            k: _convert_floats_to_decimals(v) for k, v in item.items()
        }
    elif isinstance(item, float):
        return Decimal(str(item))
    else:
        return item


class DynamoDBGateway(DBGateway):
    def __init__(self, table_name: str):
        if SNAKE_CASE_PREFIX not in table_name:
            table_name = f"{SNAKE_CASE_PREFIX}_{table_name}"

        if ENVIRONMENT not in table_name:
            table_name = f"{table_name}_{ENVIRONMENT}"

        self.table = boto3.resource("dynamodb").Table(table_name)
        self.table_name = table_name

    def delete_all(self, key_name: str, key_value: str):
        try:
            response = self._query(key_name, key_value)
            if response is None:
                # logger.debug(
                #     f'DynamoDB: Nothing to delete from dynamodb ... KeyName:"{key_name}" KeyValue:"{key_value}"',
                # )
                return

            if "Item" in response:
                # logger.debug(
                #     f'DynamoDB: Deleting from dynamodb ... KeyName:"{key_name}" KeyValue:"{key_value}"',
                # )
                self.table.delete_item(Key={key_name: key_value})
            elif "Items" in response and len(response["Items"]) > 0:
                for item in response["Items"]:
                    pk = "id"  # can we dynamically fetch the primary key name?
                    # logger.debug(
                    #     f'DynamoDB: Deleting from dynamodb ... KeyName:"{pk}" IndexValue:"{item[pk]}"',
                    # )
                    self.table.delete_item(Key={pk: item[pk]})
        except ClientError as e:
            logger.debug("DynamoDB: ❌ Fail deleting item on dynamodb")
            raise e

    def scan(self):
        # logger.debug(f"DynamoDB: Scanning from dynamodb ...")
        items = []
        response = self.table.scan()

        while response:
            items.extend(response.get("Items", []))
            if "LastEvaluatedKey" in response:
                response = self.table.scan(
                    ExclusiveStartKey=response["LastEvaluatedKey"]
                )
            else:
                break

        non_deleted_items = [item for item in items if not item.get("deleted", False)]
        return _convert_decimals_to_floats(non_deleted_items)

    def query(self, key_name: str, key_value: str):
        items = []
        response = self._query(key_name, key_value)

        while response:
            if "Item" in response:
                items.append(response["Item"])
            else:
                items.extend(response.get("Items", []))
            if "LastEvaluatedKey" in response:
                response = self._query(
                    key_name,
                    key_value,
                    exclusive_start_key=response["LastEvaluatedKey"],
                )
            else:
                break

        non_deleted_items = [
            item
            for item in items
            if not item.get("deleted", False) and not item.get("deleted_at", None)
        ]
        return _convert_decimals_to_floats(non_deleted_items)

    def write(self, data: dict):
        # logger.debug(f"DynamoDB: Writing to dynamodb ({self.table_name}) ... {data}")
        if "created_at" not in data:
            data["created_at"] = str(datetime.now(UTC).isoformat())

        # Recursively convert floats to Decimals
        processed_data = _convert_floats_to_decimals(data)

        # Remove keys with None values to avoid DynamoDB type errors, especially with GSI keys
        item_to_write = {}
        for k, v in processed_data.items():
            if v is not None:
                # The conversion is already done recursively
                item_to_write[k] = v

        try:
            # Use the filtered dictionary
            self.table.put_item(ReturnConsumedCapacity="TOTAL", Item=item_to_write)
        except ClientError as e:
            # logger.debug("DynamoDB: ❌ Fail putting item on dynamodb")
            raise e

    def count(self, key_name: str, key_value: str) -> int:
        total_count = 0
        response = self._query(key_name, key_value, select_count=True)

        while response:
            if "Count" in response and isinstance(response["Count"], int):
                total_count += response["Count"]
            if "LastEvaluatedKey" in response:
                response = self._query(
                    key_name,
                    key_value,
                    select_count=True,
                    exclusive_start_key=response["LastEvaluatedKey"],
                )
            else:
                break

        return total_count

    def _query(
        self,
        key_name: str,
        key_value: str,
        select_count: bool = False,
        exclusive_start_key=None,
    ):
        response = self._read_from_dynamo_key(
            key_name, key_value, select_count, exclusive_start_key
        )
        if response:
            return response

        response = self._read_from_dynamo_index(
            key_name, key_value, select_count, exclusive_start_key
        )
        if response:
            return response

        logger.debug(
            f'DynamoDB: Tried to read from key & index for key "{key_name}" with value "{key_value}" and failed ({self.table_name})',
        )
        return None

    def _read_from_dynamo_key(
        self,
        key_name: str,
        key_value: str,
        select_count: bool = False,
        exclusive_start_key=None,
    ):
        try:
            if select_count:
                return None
            else:
                # get_item doesn't support pagination, so we don't use ExclusiveStartKey here
                return self.table.get_item(Key={key_name: key_value})
        except ClientError as e:
            return

    def _read_from_dynamo_index(
        self,
        key_name: str,
        key_value: str,
        select_count: bool = False,
        exclusive_start_key=None,
    ):
        select_type = "COUNT" if select_count else "ALL_ATTRIBUTES"
        try:
            params = {
                "IndexName": f"{key_name}-index",
                "KeyConditionExpression": f"{key_name} = :{key_name}",
                "ExpressionAttributeValues": {f":{key_name}": key_value},
                "Select": select_type,
            }
            if exclusive_start_key:
                params["ExclusiveStartKey"] = exclusive_start_key
            return self.table.query(**params)
        except ClientError as e:
            return

    def query_by_criteria(
        self, criteria: Dict[str, Any], index_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query items based on multiple criteria.

        Args:
            criteria: Dictionary of field-value pairs. Values can be:
                     - Simple value for equality check
                     - Dict with operators ($gt, $gte, $lt, $lte, $between, $in, etc.)
                     - Array field paths using dot notation (e.g. 'sessions[].activity_id')
            index_name: Optional name of the index to use

        Example:
            query_by_criteria({
                'user_id': '123',
                'date': {'$gte': '2024-01-01', '$lte': '2024-12-31'},
                'status': 'active',
                'role': {'$in': ['admin', 'editor']},
                'sessions[].activity_id': 'abc123'  # Will find plans where any session has this activity_id
            })
        """
        expression_parts = []
        attr_names = {}
        attr_values = {}

        for field, value in criteria.items():
            # Handle array field paths by checking for [] notation
            if "[]." in field:
                base_field, array_path = field.split("[].")
                attr_name = f"#{base_field}"
                attr_names[attr_name] = base_field

                # For array fields, we use the contains function
                attr_value = f":{base_field}_{array_path}"
                attr_values[attr_value] = value

                # Create a contains expression that checks if any array element matches
                expression_parts.append(f"contains({attr_name}, {attr_value})")
            else:
                # Handle regular fields as before
                attr_name = f"#{field}"
                attr_names[attr_name] = field
                
                if isinstance(value, dict):  # Complex condition with operators
                    for op, op_value in value.items():
                        # Special handling for $in to avoid creating an unused attribute value
                        if op == '$in':
                            if not isinstance(op_value, list):
                                raise ValueError(
                                    "$in operator requires a list of values"
                                )
                            if not op_value:
                                raise ValueError(
                                    "$in operator requires a non-empty list of values"
                                )
                            
                            in_placeholders = []
                            for i, item in enumerate(op_value):
                                placeholder = f":{field}_in{i}"
                                attr_values[placeholder] = item
                                in_placeholders.append(placeholder)
                            
                            expression_parts.append(
                                f"{attr_name} IN ({', '.join(in_placeholders)})"
                            )
                        else: # Handle other operators
                            attr_value = f":{field}{op.replace('$', '')}"
                            attr_values[attr_value] = op_value
                            
                            if op == "$gt":
                                expression_parts.append(f"{attr_name} > {attr_value}")
                            elif op == "$gte":
                                expression_parts.append(f"{attr_name} >= {attr_value}")
                            elif op == "$lt":
                                expression_parts.append(f"{attr_name} < {attr_value}")
                            elif op == "$lte":
                                expression_parts.append(f"{attr_name} <= {attr_value}")
                            elif op == "$between":
                                if not isinstance(op_value, list) or len(op_value) != 2:
                                    raise ValueError(
                                        "$between operator requires a list of two values"
                                    )
                                attr_value2 = f":{field}between2"
                                attr_values[attr_value2] = op_value[1]
                                expression_parts.append(
                                    f"{attr_name} BETWEEN {attr_value} AND {attr_value2}"
                                )
                else:  # Simple equality condition
                    attr_value = f":{field}"
                    attr_values[attr_value] = value
                    expression_parts.append(f"{attr_name} = {attr_value}")

        filter_expression = " AND ".join(expression_parts)

        try:
            params = {
                "FilterExpression": filter_expression,
                "ExpressionAttributeNames": attr_names,
                "ExpressionAttributeValues": attr_values,
            }

            # Check if $in operator is used
            has_in_operator = any(isinstance(v, dict) and '$in' in v for v in criteria.values())

            # If querying by an indexed field AND $in is NOT used, try to use query instead of scan
            if (
                not has_in_operator and
                len(criteria) == 1
                and next(iter(criteria.keys())) + "-index" in self._get_table_indexes()
            ):
                index_name = next(iter(criteria.keys())) + "-index"
                params["IndexName"] = index_name
                # KeyConditionExpression must be set for query, and FilterExpression is not allowed for KeyCondition
                # We assume the single criterion is suitable for KeyConditionExpression here
                # This might need refinement if complex conditions are used on the indexed field
                params["KeyConditionExpression"] = filter_expression 
                del params["FilterExpression"] # Remove FilterExpression when using KeyConditionExpression
                response = self.table.query(**params)
            else:
                # Use scan if $in is present or if not querying a single indexed field
                response = self.table.scan(**params)

            items = response.get("Items", [])

            # Handle pagination
            while "LastEvaluatedKey" in response:
                params["ExclusiveStartKey"] = response["LastEvaluatedKey"]
                if "IndexName" in params:
                    response = self.table.query(**params)
                else:
                    response = self.table.scan(**params)
                items.extend(response.get("Items", []))

            return _convert_decimals_to_floats([item for item in items if not item.get("deleted", False)])

        except ClientError as e:
            logger.error(f"Failed to query items: {str(e)}")
            raise e

    def _get_table_indexes(self) -> List[str]:
        """Helper method to get all GSI names for the table"""
        try:
            table_description = self.table.meta.client.describe_table(
                TableName=self.table_name
            )
            gsis = table_description.get("Table", {}).get("GlobalSecondaryIndexes", [])
            return [gsi["IndexName"] for gsi in gsis]
        except ClientError as e:
            logger.error(f"Failed to get table indexes: {str(e)}")
            return []


if __name__ == "__main__":
    db = DynamoDBGateway("recommendations")
    print(
        db.query_by_criteria(
            {
                "user_id": "670fb420158ba86def604e67"
            }
        )
    )
