import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SharedResourcesStack } from './mt-shared-resources-stack'; // Import the shared resources stack

export type SharedResourcesStageOpts = {
  tenantId: string;   // Tenant ID for naming resources dynamically
  env: string;         // Environment (dev, prod, etc.)
};

export class SharedResourcesStage extends cdk.Stage {
  readonly lambdaExecutionRoleArn: string;
  readonly apiGatewayExecutionRoleArn: string;
  readonly logGroupArn: string;

  constructor(scope: Construct, id: string, opts: SharedResourcesStageOpts, props?: cdk.StageProps) {
    super(scope, id, props);

    // Instantiate the SharedResourcesStack inside this stage
    const sharedResourcesStack = new SharedResourcesStack(this, `${opts.tenantId}-SharedResourcesStack-${opts.env}`, {
      tenantId: opts.tenantId,
      env: opts.env, // Pass tenantId and env as options to the stack
    });

    // Capture the outputs from the SharedResourcesStack for use in later stages or stacks
    this.lambdaExecutionRoleArn = sharedResourcesStack.lambdaExecutionRole.roleArn;
    this.apiGatewayExecutionRoleArn = sharedResourcesStack.apiGatewayExecutionRole.roleArn;
    this.logGroupArn = sharedResourcesStack.logGroup.logGroupArn;
  }
}
