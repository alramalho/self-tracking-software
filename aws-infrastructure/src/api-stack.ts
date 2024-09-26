import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as path from "path";
import {
  CAMEL_CASE_PREFIX,
  KEBAB_CASE_PREFIX,
  PASCAL_CASE_PREFIX,
} from "./utils/constants";

interface ApiStackProps {
  environment: string;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);

    const apiCronProxyLambda = new lambda.Function(
      this,
      "ApiCronProxyLambdaFunction",
      {
        functionName: `${CAMEL_CASE_PREFIX}ApiCronProxyLambda${props.environment}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        handler: "cron_proxy.lambda_handler",
        timeout: cdk.Duration.seconds(899),
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "..", "..", "backend", "lambdas")
        ),
        environment: {
          API_URL: process.env.BACKEND_API_URL!,
        },
      }
    );
    apiCronProxyLambda.grantInvoke(
      new iam.ServicePrincipal("events.amazonaws.com")
    );

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}ApiCronProxyLambdaARN${props.environment}`,
      {
        value: apiCronProxyLambda.functionArn,
      }
    );
  }
}
