import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class FargateCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // OPTION 1: Use existing VPC
    const vpc = ec2.Vpc.fromLookup(this, "emi-vpc", {
      vpcId: "vpc-0faa54b4b6ade73b6", // Replace with your VPC ID
    });

    // OPTION 2: Create new VPC with specific configuration
    // const vpc = new ec2.Vpc(this, 'NewVpc', {
    //   maxAzs: 2, // Default is all AZs in region
    //   natGateways: 1, // Default is 1 per AZ (expensive!)
    //   subnetConfiguration: [
    //     {
    //       name: 'Public',
    //       subnetType: ec2.SubnetType.PUBLIC,
    //       cidrMask: 24
    //     },
    //     {
    //       name: 'Private',
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //       cidrMask: 24
    //     }
    //   ]
    // });

    const fargateService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "oaix_test",
        {
          vpc: vpc, // <-- Now explicitly specifying VPC
          taskImageOptions: {
            image: ecs.ContainerImage.fromRegistry(
              "emirob/emi-repo:oaix_server_image_process_amd64"
            ),
            containerPort: 8000,
          },
          publicLoadBalancer: true,
          cpu: 1024,
          memoryLimitMiB: 3072,
          desiredCount: 1,
          // Optional: Specify subnet selection
          taskSubnets: {
            subnetType: ec2.SubnetType.PUBLIC, // or PRIVATE_WITH_EGRESS
          },
        }
      );
  }
}
