import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MultiTenantStack } from './mt-infrastructure-stack'; 

export type MultitenantStackOpts = {
  tenantId: string;
  env: string;
}

export class MultiTenantStage extends cdk.Stage {
  readonly vpcId: string;
  readonly securityGroupId: string;
  readonly internetGatewayId: string;
  readonly natGatewayId: string;
  readonly elasticIp: string;
  readonly vpcPrivateSubnetIds: string[];
  readonly vpcPublicSubnetIds: string[];

  constructor(scope: Construct, id: string, opts: MultitenantStackOpts, props?: cdk.StageProps) {
    super(scope, id, props);

    // Instantiate the VPCStack
    const vpcStack = new MultiTenantStack(this, `${opts.tenantId}-VPCStack-${opts.env}`, {
      tenantId: opts.tenantId,
      env: opts.env, 
    });
  }
}
