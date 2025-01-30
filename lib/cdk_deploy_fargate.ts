import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as logs from "aws-cdk-lib/aws-logs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class FargateOAIXStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🔹 Create a simple VPC with 2 public subnets
    const oaix_prefix = "oaix-server-image-process";
    const oaix_repo = "emirob/emi-repo:oaix_server_image_process_amd64";
    const streamPrefix = "oaix_server_image_process_amd64";
    const vpc = new ec2.Vpc(this, oaix_prefix + "-vpc", {
      maxAzs: 2,
      natGateways: 0, // No NAT, fully public VPC
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // 🔹 Create an ECS Cluster
    const cluster = new ecs.Cluster(this, oaix_prefix + "-cluster", {
      vpc,
    });

    // 🔹 Create a security group that allows HTTP (port 80)
    const securityGroup = new ec2.SecurityGroup(this, oaix_prefix + "-sg", {
      vpc,
      allowAllOutbound: true,
    });

    // securityGroup.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.tcp(80),
    //   "Allow HTTP traffic"
    // );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      "Allow HTTP traffic"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS"
    );

    // 🔹 Create a Fargate Task Definition with nginx
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      oaix_prefix + "-task-def",
      {
        memoryLimitMiB: 1024 * 3,
        cpu: 256 * 4,
      }
    );

    taskDefinition.addToExecutionRolePolicy(
      new PolicyStatement({
        actions: ["*"],
        resources: ["*"],
        effect: Effect.ALLOW,
      })
    );

    const container = taskDefinition.addContainer(oaix_prefix + "-container", {
      image: ecs.ContainerImage.fromRegistry(oaix_repo),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: streamPrefix,
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    // Map container port 80
    // container.addPortMappings({
    //   containerPort: 80,
    // });

    container.addPortMappings({
      containerPort: 8000,
    });

    // 🔹 Deploy Fargate Service with a public load balancer
    const fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        oaix_prefix + "-service",
        {
          cluster,
          taskDefinition,
          desiredCount: 1,
          assignPublicIp: true,
          publicLoadBalancer: true,
          securityGroups: [securityGroup],
          healthCheckGracePeriod: cdk.Duration.seconds(60), // Allows time for container to start
        }
      );

    //Override ALB health check to ensure container is marked as "healthy"
    fargateService.targetGroup.configureHealthCheck({
      path: "/api/health", // Ensure your container responds to this path
      port: "8000",
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5, // More retries before marking unhealthy
      timeout: cdk.Duration.seconds(5),
      interval: cdk.Duration.seconds(30), // Give enough time for container to become healthy
    });

    // new cdk.CfnOutput(this, oaix_prefix + "-URL", {
    //   value: `http://${this.node.tryGetContext("nginx-loadbalancer-url")}`,
    //   description: "Access Nginx via this URL",
    // });
  }
}
