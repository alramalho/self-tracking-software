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

    const backendLambda = new lambda.DockerImageFunction(
      this,
      "AssetFunction",
      {
        functionName: `${CAMEL_CASE_PREFIX}BackendAPI${props.environment}`,
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, "..", "..", "backend")
        ),
        timeout: cdk.Duration.seconds(899),
        memorySize: 512,
        architecture: lambda.Architecture.X86_64,
        logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
        environment: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
          SHARED_ENCRYPTION_KEY: process.env.SHARED_ENCRYPTION_KEY!,
          MONGO_DB_CONNECTION_STRING: process.env.MONGO_DB_CONNECTION_STRING!,
          CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY!,
          SVIX_SECRET: process.env.SVIX_SECRET!,
          VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
          ENVIRONMENT: process.env.ENVIRONMENT!,
          JINA_API_KEY: process.env.JINA_API_KEY!,
          POSTHOG_API_KEY: process.env.POSTHOG_API_KEY!,
          ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
          OVERRIDE_AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
          OVERRIDE_AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
          LOOPS_API_KEY: process.env.LOOPS_API_KEY!,
        },
      }
    );
    backendLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "SES:SendRawEmail"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    const version = backendLambda.currentVersion;
    const aliasOptions = {
      aliasName: "live",
      version: version,
      provisionedConcurrentExecutions: 1,
    };

    const alias = new lambda.Alias(this, "BackendLambdaAlias", aliasOptions);

    const lambdaUrl = alias.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const apiCronProxyLambda = new lambda.Function(
      this,
      "ApiCronProxyLambdaFunction",
      {
        functionName: `${CAMEL_CASE_PREFIX}ApiCronProxyLambda${props.environment}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        handler: "cron_proxy.lambda_handler",
        timeout: cdk.Duration.seconds(899),
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "..", "backend", "lambdas")
        ),
        environment: {
          API_URL: lambdaUrl.url,
        },
      }
    );
    apiCronProxyLambda.grantInvoke(
      new iam.ServicePrincipal("events.amazonaws.com")
    );
    backendLambda.grantInvoke(apiCronProxyLambda);

    const s3Bucket = new s3.Bucket(this, "S3Bucket", {
      bucketName: `${KEBAB_CASE_PREFIX}-bucket-${props.environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    s3Bucket.grantReadWrite(backendLambda);

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}ApiCronProxyLambdaARN${props.environment}`,
      {
        value: apiCronProxyLambda.functionArn,
      }
    );
  }
}
