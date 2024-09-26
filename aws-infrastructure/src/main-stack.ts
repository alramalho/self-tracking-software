import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack";

interface MainStackProps {
  environment: string;
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id);

    new ApiStack(this, "ApiStack", {
      environment: props.environment,
    });
  }
}
