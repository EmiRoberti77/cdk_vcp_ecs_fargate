import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as logs from "aws-cdk-lib/aws-logs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class FargateNginxStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🔹 Create a simple VPC with 2 public subnets
    const vpc = new ec2.Vpc(this, "NginxVpc", {
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
    const cluster = new ecs.Cluster(this, "NginxCluster", {
      vpc,
    });

    // 🔹 Create a security group that allows HTTP (port 80)
    const securityGroup = new ec2.SecurityGroup(this, "NginxSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS"
    );

    // 🔹 Create a Fargate Task Definition with nginx
    const taskDefinition = new ecs.FargateTaskDefinition(this, "NginxTaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDefinition.addToExecutionRolePolicy(
      new PolicyStatement({
        actions: ["*"],
        resources: ["*"],
        effect: Effect.ALLOW,
      })
    );

    const container = taskDefinition.addContainer("NginxContainer", {
      image: ecs.ContainerImage.fromRegistry("nginx"),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "nginx",
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    // Map container port 80
    container.addPortMappings({
      containerPort: 80,
    });

    // 🔹 Deploy Fargate Service with a public load balancer
    const fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "NginxService",
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

    // Override ALB health check to ensure container is marked as "healthy"
    fargateService.targetGroup.configureHealthCheck({
      path: "/", // Ensure your container responds to this path
      port: "80",
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5, // More retries before marking unhealthy
      timeout: cdk.Duration.seconds(5),
      interval: cdk.Duration.seconds(30), // Give enough time for container to become healthy
    });

    new cdk.CfnOutput(this, "NginxURL", {
      value: `http://${this.node.tryGetContext("nginx-loadbalancer-url")}`,
      description: "Access Nginx via this URL",
    });
  }
}
