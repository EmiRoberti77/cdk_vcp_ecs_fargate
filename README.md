# ECS Fargate Deployment with AWS CDK

## Overview

This AWS CDK (Cloud Development Kit) script provisions an ECS Fargate service using AWS resources, including a VPC, security groups, ECS cluster, and an Application Load Balancer (ALB). The service runs a container from a specified Docker image repository, making it publicly accessible over port 8000.

## Key Features

- **VPC Creation**: The script creates a VPC with two public subnets and no NAT gateways to keep costs low.
- **ECS Cluster**: An ECS cluster is created within the VPC.
- **Security Group Configuration**: Ingress rules allow traffic on ports 8000 (application) and 443 (HTTPS).
- **Fargate Task Definition**: Defines the container settings, including memory, CPU, and IAM permissions.
- **Application Load Balancer**: Used to distribute traffic to the running container instances.
- **Health Check Configuration**: Ensures the service is considered healthy before routing traffic.

## Prerequisites

Before deploying this stack, ensure:

- AWS CDK is installed (`npm install -g aws-cdk`)
- AWS credentials are configured (`aws configure`)
- Environment variables are set in a `.env` file:
  ```
  STAGE=dev
  OIAX_PREFIX=oaix-server-image-process
  OAIX_DOCKER_REPO=your-docker-image-repo
  STREAM_PREFIX=oaix-server-stream
  ```

## Code Breakdown

### VPC Setup

```typescript
const vpc = new ec2.Vpc(this, oaix_prefix + "-vpc", {
  maxAzs: 2,
  natGateways: 0,
  subnetConfiguration: [
    {
      cidrMask: 24,
      name: "public",
      subnetType: ec2.SubnetType.PUBLIC,
    },
  ],
});
```

This creates a VPC with two availability zones and public subnets.

### ECS Cluster

```typescript
const cluster = new ecs.Cluster(this, oaix_prefix + "-cluster", {
  vpc,
});
```

Creates an ECS cluster to manage the containerized application.

### Security Group

```typescript
const securityGroup = new ec2.SecurityGroup(this, oaix_prefix + "-sg", {
  vpc,
  allowAllOutbound: true,
});

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
```

Allows inbound traffic on ports 8000 and 443.

### Fargate Task Definition

```typescript
const taskDefinition = new ecs.FargateTaskDefinition(
  this,
  oaix_prefix + "-task-definition",
  {
    memoryLimitMiB: 1024 * 3,
    cpu: 256 * 4,
  }
);
```

Defines the Fargate task with 3GB RAM and 1 CPU.

### Container Definition

```typescript
const container = taskDefinition.addContainer(oaix_prefix + "-container", {
  image: ecs.ContainerImage.fromRegistry(oaix_repo),
  logging: ecs.LogDriver.awsLogs({
    streamPrefix: streamPrefix,
    logRetention: logs.RetentionDays.ONE_WEEK,
  }),
});

container.addPortMappings({ containerPort: 8000 });
```

Specifies the container image and logging configuration.

### Deploying with a Load Balancer

```typescript
const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
  this,
  oaix_prefix + "-service",
  {
    cluster,
    taskDefinition,
    desiredCount: 1,
    assignPublicIp: true,
    publicLoadBalancer: true,
    securityGroups: [securityGroup],
    healthCheckGracePeriod: cdk.Duration.seconds(60),
  }
);
```

Creates an Application Load Balancer (ALB) for the service.

### Health Check Configuration

```typescript
fargateService.targetGroup.configureHealthCheck({
  path: "/api/health",
  port: "8000",
  healthyThresholdCount: 2,
  unhealthyThresholdCount: 5,
  timeout: cdk.Duration.seconds(5),
  interval: cdk.Duration.seconds(30),
});
```

Ensures that the application is only routed to healthy instances.

## Deployment

To deploy the stack, run:

```sh
cdk deploy
```

To delete the stack, use:

```sh
cdk destroy
```

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

**Author: Emi Roberti**
