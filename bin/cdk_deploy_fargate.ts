#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FargateOAIXStack } from "../lib/cdk_deploy_fargate_t3";

const app = new cdk.App();
new FargateOAIXStack(app, "oaix-server-image-process-stack", {
  env: {
    region: "us-east-1",
    account: "432599188850",
  },
});
