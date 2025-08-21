import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";
import {
  CAMEL_CASE_PREFIX,
  KEBAB_CASE_PREFIX,
  PASCAL_CASE_PREFIX,
} from "./utils/constants";

interface ApiStackProps {
  environment: string;
  certificateArn: string;
}

interface FargateDeploymentOptions {
  serviceName: string;
  backendPath: string;
  dockerfilePath: string;
  environment: Record<string, string>;
  vpc?: ec2.IVpc;
  cluster?: ecs.ICluster;
  clusterName?: string;
}

export class ApiStack extends cdk.Stack {
  public fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
  public nodeFargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
  // public fastApiLambda: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);

    // Get or create S3 bucket for both deployment types
    const s3Bucket = s3.Bucket.fromBucketName(
      this,
      "S3Bucket",
      `${KEBAB_CASE_PREFIX}-bucket-${props.environment}`
    );

    // Deploy Python backend (existing)
    const pythonEnvConfig = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
      SHARED_ENCRYPTION_KEY: process.env.SHARED_ENCRYPTION_KEY!,
      MONGO_DB_CONNECTION_STRING: process.env.MONGO_DB_CONNECTION_STRING!,
      CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY!,
      SVIX_SECRET: process.env.SVIX_SECRET!,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
      ENVIRONMENT: process.env.ENVIRONMENT!,
      JINA_API_KEY: process.env.JINA_API_KEY!,
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY!,
      ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
      OVERRIDE_AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
      OVERRIDE_AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
      LOOPS_API_KEY: process.env.LOOPS_API_KEY!,
      OTEL_ENABLED: process.env.OTEL_ENABLED!,
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT!,
      AXIOM_TOKEN: process.env.AXIOM_TOKEN!,
      AXIOM_ORG_ID: process.env.AXIOM_ORG_ID!,
      AXIOM_DATASET: process.env.AXIOM_DATASET!,
      AXIOM_BATCH_SIZE: process.env.AXIOM_BATCH_SIZE!,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!,
      STRIPE_PLUS_PRODUCT_ID: process.env.STRIPE_PLUS_PRODUCT_ID!,
      STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
      STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET!,
    };

    this.fargateService = this.deployFargateBackend(props, s3Bucket, {
      serviceName: "api",
      backendPath: "backend",
      dockerfilePath: "Dockerfile.fargate",
      environment: pythonEnvConfig,
    });

    // Deploy Node.js backend (new) - reuse VPC and cluster from Python backend
    const nodeEnvConfig = {
      DATABASE_URL: process.env.DATABASE_URL!,
      DIRECT_URL: process.env.DIRECT_URL!,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY!,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY!,
      SVIX_SECRET: process.env.SVIX_SECRET!,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY!,
      ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
      PINECONE_INDEX_HOST: process.env.PINECONE_INDEX_HOST!,
      POSTGRES_USER: process.env.POSTGRES_USER!,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD!,
      POSTGRES_HOST: process.env.POSTGRES_HOST!,
      POSTGRES_PORT: process.env.POSTGRES_PORT!,
      POSTGRES_DB: process.env.POSTGRES_DB!,
      OTEL_ENABLED: process.env.OTEL_ENABLED!,
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT!,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!,
      STRIPE_PLUS_PRODUCT_ID: process.env.STRIPE_PLUS_PRODUCT_ID!,
      STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
      STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET!,
    };

    this.nodeFargateService = this.deployFargateBackend(props, s3Bucket, {
      serviceName: "api-node",
      backendPath: ".",
      dockerfilePath: "backend-node/Dockerfile",
      environment: nodeEnvConfig,
      clusterName: `${KEBAB_CASE_PREFIX}-node-cluster-${props.environment}`,
    });

    // Setup WAF for the Python API (main API)
    this.setupWAF(props, this.fargateService.loadBalancer);

    // this.deployLambdaBackend(props, s3Bucket);
  }

  // private deployLambdaBackend(props: ApiStackProps, s3Bucket: s3.IBucket) {
  //   this.fastApiLambda = new lambda.DockerImageFunction(this, "AssetFunction", {
  //     functionName: `${CAMEL_CASE_PREFIX}BackendAPI${props.environment}`,
  //     code: lambda.DockerImageCode.fromImageAsset(
  //       path.join(__dirname, "..", "..", "backend"),
  //       {
  //         file: "Dockerfile.lambda", // Use the Lambda-specific Dockerfile
  //       }
  //     ),
  //     timeout: cdk.Duration.seconds(899),
  //     memorySize: 1024,
  //     architecture: lambda.Architecture.X86_64,
  //     logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
  //     environment: {
  //       OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  //       SHARED_ENCRYPTION_KEY: process.env.SHARED_ENCRYPTION_KEY!,
  //       MONGO_DB_CONNECTION_STRING: process.env.MONGO_DB_CONNECTION_STRING!,
  //       CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY!,
  //       SVIX_SECRET: process.env.SVIX_SECRET!,
  //       VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY!,
  //       ENVIRONMENT: process.env.ENVIRONMENT!,
  //       JINA_API_KEY: process.env.JINA_API_KEY!,
  //       POSTHOG_API_KEY: process.env.POSTHOG_API_KEY!,
  //       ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
  //       OVERRIDE_AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  //       OVERRIDE_AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  //       LOOPS_API_KEY: process.env.LOOPS_API_KEY!,

  //       // OpenTelemetry Configuration
  //       OTEL_ENABLED: process.env.OTEL_ENABLED!,
  //       OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
  //         process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT!,
  //       OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:
  //         process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT!,

  //       // Axiom Configuration
  //       AXIOM_TOKEN: process.env.AXIOM_TOKEN!,
  //       AXIOM_ORG_ID: process.env.AXIOM_ORG_ID!,
  //       AXIOM_DATASET: process.env.AXIOM_DATASET!,
  //       AXIOM_BATCH_SIZE: process.env.AXIOM_BATCH_SIZE!,

  //       TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
  //       TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID!,

  //       STRIPE_PLUS_PRODUCT_ID: process.env.STRIPE_PLUS_PRODUCT_ID!,
  //       STRIPE_API_KEY: process.env.STRIPE_API_KEY!,
  //       STRIPE_ENDPOINT_SECRET: process.env.STRIPE_ENDPOINT_SECRET!,

  //       DEPLOYMENT_TIMESTAMP: Date.now().toString(), // force image redeploying
  //     },
  //   });
  //   this.fastApiLambda.addToRolePolicy(
  //     new iam.PolicyStatement({
  //       actions: ["ses:SendEmail", "SES:SendRawEmail"],
  //       resources: ["*"],
  //       effect: iam.Effect.ALLOW,
  //     })
  //   );

  //   const version = this.fastApiLambda.currentVersion;
  //   const aliasOptions = {
  //     aliasName: "live",
  //     version: version,
  //     provisionedConcurrentExecutions: 0,
  //     description: `Deployment ${Date.now()}`,
  //   };

  //   const alias = new lambda.Alias(this, "BackendLambdaAlias", aliasOptions);

  //   const lambdaUrl = alias.addFunctionUrl({
  //     authType: lambda.FunctionUrlAuthType.NONE,
  //   });

  //   new cdk.CfnOutput(
  //     this,
  //     `${PASCAL_CASE_PREFIX}BackendLambdaURL${props.environment}`,
  //     {
  //       value: lambdaUrl.url,
  //     }
  //   );

  //   const apiCronProxyLambda = new lambda.Function(
  //     this,
  //     "LambdaApiCronProxyFunction",
  //     {
  //       functionName: `${CAMEL_CASE_PREFIX}LambdaApiCronProxy${props.environment}`,
  //       runtime: lambda.Runtime.PYTHON_3_10,
  //       handler: "cron_proxy.lambda_handler",
  //       timeout: cdk.Duration.seconds(899),
  //       code: lambda.Code.fromAsset(
  //         path.join(__dirname, "..", "..", "backend", "lambdas")
  //       ),
  //       environment: {
  //         API_URL: lambdaUrl.url,
  //         ADMIN_API_KEY: process.env.ADMIN_API_KEY!,
  //       },
  //     }
  //   );
  //   apiCronProxyLambda.grantInvoke(
  //     new iam.ServicePrincipal("events.amazonaws.com")
  //   );
  //   this.fastApiLambda.grantInvoke(apiCronProxyLambda);

  //   s3Bucket.grantReadWrite(this.fastApiLambda);

  //   new cdk.CfnOutput(
  //     this,
  //     `${PASCAL_CASE_PREFIX}LambdaApiCronProxyARN${props.environment}`,
  //     {
  //       value: apiCronProxyLambda.functionArn,
  //     }
  //   );
  // }

  private deployFargateBackend(
    props: ApiStackProps,
    s3Bucket: s3.IBucket,
    options: FargateDeploymentOptions
  ) {
    // Create or reuse VPC for Fargate service
    const fargateVpc =
      options.vpc ||
      new ec2.Vpc(this, `SharedVPC-${options.serviceName}`, {
        maxAzs: 2, // Use 2 Availability Zones for redundancy
        natGateways: 1, // Minimize costs by using just 1 NAT Gateway
      });

    // Create or reuse ECS Cluster to run Fargate tasks
    const fargateCluster =
      options.cluster ||
      new ecs.Cluster(this, `Cluster-${options.serviceName}`, {
        vpc: fargateVpc,
        clusterName:
          options.clusterName ||
          `${KEBAB_CASE_PREFIX}-cluster-${props.environment}`,
        containerInsights: true,
      });

    const logGroup = new logs.LogGroup(
      this,
      `ApiLogGroup-${options.serviceName}`,
      {
        logGroupName: `/ecs/${KEBAB_CASE_PREFIX}-${options.serviceName}-${props.environment}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    let certificate = acm.Certificate.fromCertificateArn(
      this,
      `ImportedCertificate-${options.serviceName}`,
      process.env.CERTIFICATE_ARN!
    );

    const fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        `ApiService-${options.serviceName}`,
        {
          cluster: fargateCluster,
          serviceName: `${KEBAB_CASE_PREFIX}-${options.serviceName}-${props.environment}`,
          taskImageOptions: {
            image: ecs.ContainerImage.fromAsset(
              path.join(__dirname, "..", "..", options.backendPath),
              {
                file: options.dockerfilePath,
                platform: ecr_assets.Platform.LINUX_AMD64, // Explicitly specify x86_64 architecture
              }
            ),
            containerPort: 8000,
            logDriver: ecs.LogDrivers.awsLogs({
              logGroup,
              streamPrefix: options.serviceName,
            }),
            environment: options.environment,
          },
          desiredCount: 1, // Start with 1 task
          cpu: 512, // 0.5 vCPU
          memoryLimitMiB: 1024, // 1 GB memory
          publicLoadBalancer: true, // Expose the service to the internet
          certificate: certificate, // Use the imported certificate if available
          redirectHTTP: true, // Redirect HTTP to HTTPS if we have a certificate
          idleTimeout: cdk.Duration.seconds(180),
        }
      );

    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
    });

    // Set up autoscaling
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization(`CpuScaling-${options.serviceName}`, {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization(`MemoryScaling-${options.serviceName}`, {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Grant the task execution role permissions to access S3
    s3Bucket.grantReadWrite(fargateService.taskDefinition.taskRole);

    // Add SES permissions
    fargateService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "SES:SendRawEmail"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    // Determine the API URL based on certificate availability
    const apiUrl =
      options.serviceName === "api"
        ? "https://api.tracking.so"
        : `https://${options.serviceName}.tracking.so`;

    // Create the proxy lambda for cron jobs pointing to Fargate
    const apiCronProxyLambda = new lambda.Function(
      this,
      `FargateApiCronProxyFunction-${options.serviceName}`,
      {
        functionName: `${CAMEL_CASE_PREFIX}Fargate${options.serviceName}CronProxy${props.environment}`,
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
      `${PASCAL_CASE_PREFIX}Fargate${options.serviceName}ApiURL${props.environment}`,
      {
        value: apiUrl,
      }
    );

    // Output the actual ALB DNS name for manual DNS configuration
    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}LoadBalancer${options.serviceName}DNS${props.environment}`,
      {
        value: fargateService.loadBalancer.loadBalancerDnsName,
        description: `Load Balancer DNS Name for ${options.serviceName} - Set your domain's CNAME record to point to this`,
      }
    );

    new cdk.CfnOutput(
      this,
      `${PASCAL_CASE_PREFIX}Fargate${options.serviceName}ApiCronProxyARN${props.environment}`,
      {
        value: apiCronProxyLambda.functionArn,
      }
    );

    return fargateService;
  }

  private setupWAF(props: ApiStackProps, loadBalancer: any) {
    // --- Read Allowed Routes ---
    const allowedRoutesFilePath = path.join(
      __dirname,
      "..",
      "allowed-routes.txt"
    ); // Path relative to src/api-stack.ts
    let allowedRoutesRegex: string[] = [];
    try {
      const allowedRoutesContent = fs.readFileSync(
        allowedRoutesFilePath,
        "utf-8"
      );
      // console.log("Raw allowed routes content:\n", allowedRoutesContent); // Keep or remove as needed

      const lines = allowedRoutesContent.split(/\r?\n/);

      const routeSegments: string[] = Array.from(
        new Set(
          lines
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length > 0 && !line.startsWith("#") && line.startsWith("/")
            )
            .map((route) => {
              // Escape regex chars EXCEPT curly braces initially
              let segment = route.replace(/[.*+?^$()|[\\]\\]/g, "\\$&"); // Leave {} alone
              // Now replace literal {param} with the unescaped regex .*
              segment = segment.replace(/\{[^}]+\}/g, ".*"); // Changed [^/]+ to .*
              return segment;
            })
            .map((segment) => {
              const match = segment.match(/(.*?\/\.\*).*/);
              return match ? match[1] : segment;
            })
        )
      );

      // --- NEW: Split route segments into multiple regex patterns to avoid length limits ---
      const MAX_REGEX_LENGTH = 200; // Stay under WAF's 512 limit
      const combinedRegexList: string[] = [];
      let currentPatternSegments: string[] = [];

      for (const segment of routeSegments) {
        // Calculate length if this segment is added to the current pattern
        const testPattern = `^(${[...currentPatternSegments, segment].join(
          "|"
        )})$`;

        if (
          currentPatternSegments.length > 0 &&
          testPattern.length > MAX_REGEX_LENGTH
        ) {
          // Current pattern is full, finalize it
          combinedRegexList.push(`^(${currentPatternSegments.join("|")})$`);
          // Start new pattern with the current segment
          currentPatternSegments = [segment];
        } else {
          // Add segment to the current pattern
          currentPatternSegments.push(segment);
        }
      }

      // Add the last pattern if it has segments
      if (currentPatternSegments.length > 0) {
        combinedRegexList.push(`^(${currentPatternSegments.join("|")})$`);
      }

      // Assign the list of combined regex patterns
      console.log("Combined Regex List:", combinedRegexList);
      allowedRoutesRegex = combinedRegexList;
    } catch (error) {
      console.error(
        `Error reading allowed routes file at ${allowedRoutesFilePath}:`,
        error
      );
      throw new Error(`Failed to read routes file: ${allowedRoutesFilePath}`);
    }

    // --- Create Regex Pattern Set for Allowed Routes ---
    const allowedRoutesPatternSet = new wafv2.CfnRegexPatternSet(
      this,
      "AllowedRoutesPatternSet",
      {
        name: `${PASCAL_CASE_PREFIX}-allowed-routes-set-${props.environment}-${cdk.Aws.REGION}`.substring(
          0,
          128
        ), // Ensure name uniqueness and length
        scope: "REGIONAL",
        // Use the list of combined regex patterns generated above
        regularExpressionList: allowedRoutesRegex,
        description: "Regex patterns for allowed URI paths read from file",
      }
    );

    // Create WAF Web ACL
    const webAcl = new wafv2.CfnWebACL(this, "WebACL", {
      defaultAction: {
        block: {
          // *** CHANGE: Default action is now BLOCK ***
          customResponse: {
            // Optional: Provide a custom response for blocked requests
            responseCode: 403,
            customResponseBodyKey: "blocked-by-waf",
          },
        },
      },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${PASCAL_CASE_PREFIX}-web-acl-metric-${props.environment}`,
        sampledRequestsEnabled: true,
      },
      customResponseBodies: {
        "blocked-by-waf": {
          contentType: "APPLICATION_JSON",
          content: JSON.stringify({
            error: "Access denied by WAF", // Generic block message
          }),
        },
        "access-denied-route": {
          // Optional: Specific message if needed for route blocks
          contentType: "APPLICATION_JSON",
          content: JSON.stringify({
            error: "Access denied: Route not allowed",
          }),
        },
      },
      rules: [
        // Rule 1 (Priority 0): Allow requests with a specific API token (Bypass)
        {
          name: "AllowApiTokenBypass",
          priority: 0, // Highest priority to run first
          statement: {
            byteMatchStatement: {
              fieldToMatch: {
                singleHeader: {
                  Name: "x-api-token",
                },
              },
              positionalConstraint: "EXACTLY",
              // Use an environment variable for the token value for security
              searchString: process.env.WAF_BYPASS_TOKEN!,
              textTransformations: [
                {
                  priority: 0,
                  type: "NONE",
                },
              ],
            },
          },
          action: {
            allow: {}, // Allow the request if the token matches
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-api-token-bypass-metric-${props.environment}`,
          },
        },
        // Rule 2 (Priority 1): Allow requests matching the routes file
        {
          name: "AllowListedRoutes",
          priority: 1, // Runs after token bypass
          statement: {
            regexPatternSetReferenceStatement: {
              arn: allowedRoutesPatternSet.attrArn, // Reference the pattern set
              fieldToMatch: {
                uriPath: {}, // Match against the URI path
              },
              textTransformations: [
                {
                  priority: 0,
                  type: "NONE", // No transformation needed for exact path match
                },
              ],
            },
          },
          action: {
            allow: {}, // Allow if the path matches
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-allow-listed-routes-metric-${props.environment}`,
          },
        },
        // Rule 3 (Priority 5): Allow large file uploads for /log-activity endpoint (Re-added)
        {
          name: "AllowLargeFileUploads",
          priority: 5, // Priority after general allow, before rate limit/managed rules
          statement: {
            byteMatchStatement: {
              fieldToMatch: {
                uriPath: {},
              },
              positionalConstraint: "EXACTLY",
              searchString: "/log-activity", // Specific path for this rule
              textTransformations: [
                {
                  priority: 0, // Use 0 here, consistent with other uriPath matches
                  type: "NONE",
                },
              ],
            },
          },
          action: {
            // Keep original action, likely interacts with size restrictions
            allow: {
              customRequestHandling: {
                insertHeaders: [
                  {
                    name: "x-waf-rule",
                    value: "large-file-upload",
                  },
                ],
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-large-file-uploads-metric-${props.environment}`,
          },
        },
        // Rule 4 (Priority 10): Rate limiting rule (Priority Adjusted)
        {
          name: "RateLimitRule",
          priority: 10, // Lower priority than allow rules
          statement: {
            rateBasedStatement: {
              limit: 500,
              aggregateKeyType: "IP",
            },
          },
          action: {
            block: {
              // Block if rate limit exceeded
              customResponse: {
                responseCode: 429, // Too Many Requests
                customResponseBodyKey: "blocked-by-waf", // Reuse generic block message
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-rate-limit-metric-${props.environment}`,
          },
        },
        // Rule 5 (Priority 20): AWS Managed Rules - Common Rule Set (Priority Adjusted)
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 20, // Lower priority
          overrideAction: { none: {} }, // Use default actions of the rule group
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
              // Keep exclusion if large uploads on *allowed* paths are needed, otherwise remove
              excludedRules: [{ name: "SizeRestrictions_BODY" }],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-common-rules-metric-${props.environment}`,
          },
        },
        // Rule 6 (Priority 30): AWS Managed Rules - SQL Injection Rule Set (Priority Adjusted)
        {
          name: "AWSManagedRulesSQLiRuleSet",
          priority: 30, // Lower priority
          overrideAction: { none: {} }, // Use default actions
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${PASCAL_CASE_PREFIX}-sql-injection-metric-${props.environment}`,
          },
        },
      ],
    });

    // Associate WAF Web ACL with the Application Load Balancer
    new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", {
      resourceArn: loadBalancer.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });
  }
}
