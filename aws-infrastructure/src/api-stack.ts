import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import * as path from "path";
import {
  CAMEL_CASE_PREFIX,
  KEBAB_CASE_PREFIX,
  PASCAL_CASE_PREFIX,
} from "./utils/constants";

interface ApiStackProps {
  environment: string;
  certificateArn?: string;
}

export class ApiStack extends cdk.Stack {
  public fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
  public fastApiLambda: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);

    // Get or create S3 bucket for both deployment types
    const s3Bucket = s3.Bucket.fromBucketName(
      this,
      "S3Bucket",
      `${KEBAB_CASE_PREFIX}-bucket-${props.environment}`
    );

    this.deployFargateBackend(props, s3Bucket);
    this.deployLambdaBackend(props, s3Bucket);
  }

  private deployLambdaBackend(props: ApiStackProps, s3Bucket: s3.IBucket) {
    this.fastApiLambda = new lambda.DockerImageFunction(this, "AssetFunction", {
      functionName: `${CAMEL_CASE_PREFIX}BackendAPI${props.environment}`,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "..", "..", "backend"),
        {
          file: "Dockerfile.lambda", // Use the Lambda-specific Dockerfile
        }
      ),
      timeout: cdk.Duration.seconds(899),
      memorySize: 1024,
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

        // OpenTelemetry Configuration
        OTEL_ENABLED: process.env.OTEL_ENABLED!,
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
          process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
          process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT!,

        // Axiom Configuration
        AXIOM_TOKEN: process.env.AXIOM_TOKEN!,
        AXIOM_ORG_ID: process.env.AXIOM_ORG_ID!,
        AXIOM_DATASET: process.env.AXIOM_DATASET!,
        AXIOM_BATCH_SIZE: process.env.AXIOM_BATCH_SIZE!,

        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!,

        STRIPE_PLUS_PRODUCT_ID: process.env.STRIPE_PLUS_PRODUCT_ID!,
        STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
        STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET!,

        DEPLOYMENT_TIMESTAMP: Date.now().toString(), // force image redeploying
      },
    });
    this.fastApiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "SES:SendRawEmail"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    const version = this.fastApiLambda.currentVersion;
    const aliasOptions = {
      aliasName: "live",
      version: version,
      provisionedConcurrentExecutions: 0,
      description: `Deployment ${Date.now()}`,
    };

    const alias = new lambda.Alias(this, "BackendLambdaAlias", aliasOptions);

    const lambdaUrl = alias.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}BackendLambdaURL${props.environment}`,
      {
        value: lambdaUrl.url,
      }
    );

    const apiCronProxyLambda = new lambda.Function(
      this,
      "LambdaApiCronProxyFunction",
      {
        functionName: `${CAMEL_CASE_PREFIX}LambdaApiCronProxy${props.environment}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        handler: "cron_proxy.lambda_handler",
        timeout: cdk.Duration.seconds(899),
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "..", "backend", "lambdas")
        ),
        environment: {
          API_URL: lambdaUrl.url,
          ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
        },
      }
    );
    apiCronProxyLambda.grantInvoke(
      new iam.ServicePrincipal("events.amazonaws.com")
    );
    this.fastApiLambda.grantInvoke(apiCronProxyLambda);

    s3Bucket.grantReadWrite(this.fastApiLambda);

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}LambdaApiCronProxyARN${props.environment}`,
      {
        value: apiCronProxyLambda.functionArn,
      }
    );
  }

  private deployFargateBackend(props: ApiStackProps, s3Bucket: s3.IBucket) {
    // Create VPC for Fargate service
    const vpc = new ec2.Vpc(this, "VPC", {
      maxAzs: 2, // Use 2 Availability Zones for redundancy
      natGateways: 1, // Minimize costs by using just 1 NAT Gateway
    });

    // Create ECS Cluster to run Fargate tasks
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: `${KEBAB_CASE_PREFIX}-cluster-${props.environment}`,
      containerInsights: true,
    });

    const logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/ecs/${KEBAB_CASE_PREFIX}-api-${props.environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const domainName = "api.tracking.so";
    const certificate = new acm.Certificate(this, "certificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(),
    });

    this.fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "ApiService",
        {
          cluster,
          serviceName: `${KEBAB_CASE_PREFIX}-api-${props.environment}`,
          taskImageOptions: {
            image: ecs.ContainerImage.fromAsset(
              path.join(__dirname, "..", "..", "backend"),
              {
                file: "Dockerfile.fargate", // Use the Fargate-specific Dockerfile
                platform: ecr_assets.Platform.LINUX_AMD64, // Explicitly specify x86_64 architecture
              }
            ),
            containerPort: 8000,
            logDriver: ecs.LogDrivers.awsLogs({
              logGroup,
              streamPrefix: "api",
            }),
            environment: {
              OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
              SHARED_ENCRYPTION_KEY: process.env.SHARED_ENCRYPTION_KEY!,
              MONGO_DB_CONNECTION_STRING:
                process.env.MONGO_DB_CONNECTION_STRING!,
              CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY!,
              SVIX_SECRET: process.env.SVIX_SECRET!,
              VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
              ENVIRONMENT: process.env.ENVIRONMENT!,
              JINA_API_KEY: process.env.JINA_API_KEY!,
              POSTHOG_API_KEY: process.env.POSTHOG_API_KEY!,
              ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
              OVERRIDE_AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
              OVERRIDE_AWS_SECRET_ACCESS_KEY:
                process.env.AWS_SECRET_ACCESS_KEY!,
              LOOPS_API_KEY: process.env.LOOPS_API_KEY!,

              // OpenTelemetry Configuration
              OTEL_ENABLED: process.env.OTEL_ENABLED!,
              OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
                process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
              OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
                process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT!,

              // Axiom Configuration
              AXIOM_TOKEN: process.env.AXIOM_TOKEN!,
              AXIOM_ORG_ID: process.env.AXIOM_ORG_ID!,
              AXIOM_DATASET: process.env.AXIOM_DATASET!,
              AXIOM_BATCH_SIZE: process.env.AXIOM_BATCH_SIZE!,

              TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
              TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!,

              STRIPE_PLUS_PRODUCT_ID: process.env.STRIPE_PLUS_PRODUCT_ID!,
              STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
              STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET!,
            },
          },
          desiredCount: 1, // Start with 1 task
          cpu: 512, // 0.5 vCPU
          memoryLimitMiB: 1024, // 1 GB memory
          publicLoadBalancer: true, // Expose the service to the internet
          redirectHTTP: true, // Redirect HTTP to HTTPS if we have a certificate
          certificate: certificate,
          domainName: domainName,
          listenerPort: 443,
        }
      );

    // Set up autoscaling
    const scaling = this.fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Grant the task execution role permissions to access S3
    s3Bucket.grantReadWrite(this.fargateService.taskDefinition.taskRole);

    // Add SES permissions
    this.fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "SES:SendRawEmail"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    // Determine the API URL based on certificate availability
    const apiUrl = "https://api.tracking.so";

    // Create the proxy lambda for cron jobs pointing to Fargate
    const apiCronProxyLambda = new lambda.Function(
      this,
      "FargateApiCronProxyFunction",
      {
        functionName: `${CAMEL_CASE_PREFIX}FargateApiCronProxy${props.environment}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        handler: "cron_proxy.lambda_handler",
        timeout: cdk.Duration.seconds(899),
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "..", "backend", "lambdas")
        ),
        environment: {
          API_URL: apiUrl,
          ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
        },
      }
    );
    apiCronProxyLambda.grantInvoke(
      new iam.ServicePrincipal("events.amazonaws.com")
    );

    // Output the API endpoint URL
    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}FargateApiURL${props.environment}`,
      {
        value: apiUrl,
      }
    );

    // Output the actual ALB DNS name for manual DNS configuration
    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}LoadBalancerDNS${props.environment}`,
      {
        value: this.fargateService.loadBalancer.loadBalancerDnsName,
        description:
          "Load Balancer DNS Name - Set your domain's CNAME record to point to this",
      }
    );

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}FargateApiCronProxyARN${props.environment}`,
      {
        value: apiCronProxyLambda.functionArn,
      }
    );
  }
}
