#!/usr/bin/env node
import * as dotenv from "dotenv";
import * as cdk from "aws-cdk-lib";
import { FargateOAIXStack } from "../lib/cdk_deploy_fargate_t3";

dotenv.config();

const app = new cdk.App();
new FargateOAIXStack(app, "oaix-server-image-process-stack", {
  env: {
    region: "us-east-1",
    account: process.env.ACCOUNT!,
  },
});
