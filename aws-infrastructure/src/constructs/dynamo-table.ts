import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface Props {
  name: string;
  indexFields?: string[];
  partitionKey?: { name: string; type: dynamodb.AttributeType };
  writableBy?: iam.IGrantable[];
  readableBy?: iam.IGrantable[];
}

export class DynamoDbTableConstruct extends Construct {
  readonly dynamoTableName: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const dynamoTable = new dynamodb.Table(this, `${props.name}DynamoDbTable`, {
      tableName: props.name,
      partitionKey: props.partitionKey ?? {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    props?.indexFields?.forEach((field) =>
      dynamoTable.addGlobalSecondaryIndex({
        indexName: `${field}-index`,
        partitionKey: { name: field, type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      })
    );
    props?.writableBy?.forEach((resource) =>
      dynamoTable.grantWriteData(resource)
    );
    props?.readableBy?.forEach((resource) =>
      dynamoTable.grantReadData(resource)
    );

    this.dynamoTableName = dynamoTable.tableName;
  }
}
