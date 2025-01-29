import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecspatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as logs from "aws-cdk-lib/aws-logs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class CdkDeployDefaultFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Use the default VPC
    const vpc = ec2.Vpc.fromLookup(this, "emi_vpc", {
      isDefault: true,
    });

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecsSecurityGroup", {
      vpc,
      allowAllOutbound: true, // Allow all outbound traffic
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP from anywhere"
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      "Allow HTTP on port 8000"
    );

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    taskDefinition.addToExecutionRolePolicy(
      new PolicyStatement({
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
        effect: Effect.ALLOW,
      })
    );

    const cluster = new ecs.Cluster(this, "service-cluster", {
      clusterName: "service-cluster",
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      vpc,
    });

    const container = taskDefinition.addContainer("nginx-container", {
      image: ecs.ContainerImage.fromRegistry("nginx"),
      //command: ["nginx", "-g", "daemon off;"], // Ensure nginx stays running
      memoryLimitMiB: 1024,
      cpu: 512,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: id,
        logRetention: logs.RetentionDays.FIVE_DAYS,
      }),
    });

    container.addPortMappings({ containerPort: 80 });
    container.addPortMappings({ containerPort: 8000 });

    const fargateService =
      new ecspatterns.ApplicationLoadBalancedFargateService(
        this,
        "nginx-ecs-sample",
        {
          cluster,
          taskDefinition,
          desiredCount: 1,
          assignPublicIp: true,
          securityGroups: [ecsSecurityGroup],
          publicLoadBalancer: true,
        }
      );

    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(80),
      "Allow traffic from Load Balancer on port 80"
    );

    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(8000),
      "Allow traffic from Load Balancer on port 8000"
    );

    fargateService.loadBalancer.connections.allowFromAnyIpv4(
      ec2.Port.tcp(80),
      "Allow traffic to Load Balancer on port 80"
    );
    fargateService.loadBalancer.connections.allowFromAnyIpv4(
      ec2.Port.tcp(8000),
      "Allow traffic to Load Balancer on port 8000"
    );

    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(80),
      "Allow traffic from Load Balancer on port 80"
    );

    fargateService.service.connections.allowFrom(
      fargateService.loadBalancer,
      ec2.Port.tcp(8000),
      "Allow traffic from Load Balancer on port 8000"
    );
  }
}
