import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack";
import { DbStack } from "./db-stack";

interface MainStackProps {
  environment: string;
  certificateArn: string;
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id);

    // Deploy Lambda backend
    const { fargateService } = new ApiStack(this, "ApiStack", {
      environment: props.environment,
      certificateArn: props.certificateArn,
    });

    new DbStack(this, "DbStack", {
      environment: props.environment,
      writableBy: [fargateService.taskDefinition.taskRole],
      readableBy: [fargateService.taskDefinition.taskRole],
    });
  }
}
