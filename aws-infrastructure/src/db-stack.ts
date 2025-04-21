import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { SNAKE_CASE_PREFIX } from "./utils/constants";
import { DynamoDbTableConstruct } from "./constructs/dynamo-table";

interface MainStackProps {
  environment: string;
  writableBy?: iam.IGrantable[];
  readableBy?: iam.IGrantable[];
}

export class DbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id);

    // Users Table
    new DynamoDbTableConstruct(this, "UsersTable", {
      name: `${SNAKE_CASE_PREFIX}_users_${props.environment}`,
      indexFields: ["clerk_id", "email", "username"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Activities Table
    new DynamoDbTableConstruct(this, "ActivitiesTable", {
      name: `${SNAKE_CASE_PREFIX}_activities_${props.environment}`,
      indexFields: ["user_id", "title"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Activity Entries Table
    new DynamoDbTableConstruct(this, "ActivityEntriesTable", {
      name: `${SNAKE_CASE_PREFIX}_activity_entries_${props.environment}`,
      indexFields: ["user_id", "activity_id", "date"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Metrics Table
    new DynamoDbTableConstruct(this, "MetricsTable", {
      name: `${SNAKE_CASE_PREFIX}_metrics_${props.environment}`,
      indexFields: ["user_id", "title"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Metric Entries Table
    new DynamoDbTableConstruct(this, "MetricEntriesTable", {
      name: `${SNAKE_CASE_PREFIX}_metric_entries_${props.environment}`,
      indexFields: ["user_id", "metric_id", "date"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Plans Table
    new DynamoDbTableConstruct(this, "PlansTable", {
      name: `${SNAKE_CASE_PREFIX}_plans_${props.environment}`,
      indexFields: ["user_id", "plan_group_id"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Plan Groups Table
    new DynamoDbTableConstruct(this, "PlanGroupsTable", {
      name: `${SNAKE_CASE_PREFIX}_plan_groups_${props.environment}`,
      indexFields: ["user_id", "members.user_id"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Friend Requests Table
    new DynamoDbTableConstruct(this, "FriendRequestsTable", {
      name: `${SNAKE_CASE_PREFIX}_friend_requests_${props.environment}`,
      indexFields: ["sender_id", "recipient_id", "status"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Plan Invitations Table
    new DynamoDbTableConstruct(this, "PlanInvitationsTable", {
      name: `${SNAKE_CASE_PREFIX}_plan_invitations_${props.environment}`,
      indexFields: ["sender_id", "recipient_id", "plan_id", "status"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Mood Reports Table
    new DynamoDbTableConstruct(this, "MoodReportsTable", {
      name: `${SNAKE_CASE_PREFIX}_mood_reports_${props.environment}`,
      indexFields: ["user_id", "date"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Messages Table
    new DynamoDbTableConstruct(this, "MessagesTable", {
      name: `${SNAKE_CASE_PREFIX}_messages_${props.environment}`,
      indexFields: ["user_id", "sender_id", "recipient_id", "type"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Notifications Table
    new DynamoDbTableConstruct(this, "NotificationsTable", {
      name: `${SNAKE_CASE_PREFIX}_notifications_${props.environment}`,
      indexFields: ["user_id", "type", "read", "status"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });

    // Recommendations Table
    new DynamoDbTableConstruct(this, "RecommendationsTable", {
      name: `${SNAKE_CASE_PREFIX}_recommendations_${props.environment}`,
      indexFields: ["user_id"],
      writableBy: props.writableBy,
      readableBy: props.readableBy,
    });
  }
}
