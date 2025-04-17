import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VPCStack } from './mt-vpc-stack'; // Assuming the VPC stack is defined in a separate file // Assuming you have a types file to define the Env type

export type VPCStackOpts = {
  tenantId: string;
  env: string; // Environment (e.g., dev, prod)
}

export class VPCStage extends cdk.Stage {
  readonly vpcId: string;
  readonly securityGroupId: string;
  readonly internetGatewayId: string;
  readonly natGatewayId: string;
  readonly elasticIp: string;
  readonly vpcPrivateSubnetIds: string[];
  readonly vpcPublicSubnetIds: string[];

  constructor(scope: Construct, id: string, opts: VPCStackOpts, props?: cdk.StageProps) {
    super(scope, id, props);

    // Instantiate the VPCStack inside this stage
    const vpcStack = new VPCStack(this, `${opts.tenantId}-VPCStack-${opts.env}`, {
      tenantId: opts.tenantId,
      env: opts.env, // Pass the environment and tenantId as options
    });

    // Capture the outputs from the VPCStack for use in later stages or stacks
    this.vpcId = vpcStack.vpc.vpcId;
    this.securityGroupId = vpcStack.securityGroup.securityGroupId;
    this.internetGatewayId = vpcStack.internetGateway.ref;
    this.natGatewayId = vpcStack.natGateway.ref;
    this.elasticIp = vpcStack.elasticIp.ref;
    this.vpcPrivateSubnetIds = vpcStack.privateSubnetIds;
    this.vpcPublicSubnetIds = vpcStack.publicSubnetIds;
  }
}
