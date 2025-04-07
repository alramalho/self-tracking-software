#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { MainStack } from "./main-stack";
import { PASCAL_CASE_PREFIX } from "./utils/constants";
dotenv.config({ path: ".env" });
dotenv.config({ path: "../.env" });

const app = new cdk.App();

if (!process.env.ENVIRONMENT) {
  console.error("\x1b[41m%s\x1b[0m", "ERROR: ENVIRONMENT variable is not set.");
  process.exit(1);
} else if (!process.env.CERTIFICATE_ARN) {
  console.error(
    "\x1b[41m%s\x1b[0m",
    "ERROR: CERTIFICATE_ARN variable is not set."
  );
  process.exit(1);
} else {
  console.warn(
    "\x1b[43m%s\x1b[0m",
    `WARNING: Using environment ${process.env.ENVIRONMENT}`
  );
}

new MainStack(
  app,
  `${PASCAL_CASE_PREFIX}InfrastructureStack${process.env.ENVIRONMENT}`,
  {
    // @ts-ignore
    environment: process.env.ENVIRONMENT,
    certificateArn: process.env.CERTIFICATE_ARN,
  }
);
