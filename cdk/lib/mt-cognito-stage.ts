import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoStack } from './mt-cognito-stack';  // Import the Cognito stack
import { Env } from '../types/types';  // Import the Env type for environment

export type CognitoStackOpts = {
  tenantId: string;  // Tenant identifier to differentiate resources for each tenant
  env: Env;          // Environment (dev, prod, etc.)
}

export class CognitoStage extends cdk.Stage {
  readonly userPoolId: string;
  readonly userPoolArn: string;
  readonly identityPoolId: string;
  readonly userPoolName: string;
  readonly unauthRoleArn: string;
  readonly authRoleArn: string;

  constructor(scope: Construct, id: string, opts: CognitoStackOpts, props?: cdk.StageProps) {
    super(scope, id, props);

    // Instantiate the CognitoStack inside this stage
    const cognitoStack = new CognitoStack(this, 'CognitoStack', {
      tenantId: opts.tenantId,  // Passing tenantId to the CognitoStack
      env: opts.env,  // Passing environment (dev, prod, etc.)
    });

    // Reference outputs from the CognitoStack
    this.userPoolId = cognitoStack.userPoolId;
    this.userPoolArn = cognitoStack.userPoolArn;
    this.identityPoolId = cognitoStack.identityPoolId;
    this.userPoolName = cognitoStack.userPoolName;
    this.unauthRoleArn = cognitoStack.unauthRoleArn;
    this.authRoleArn = cognitoStack.authRoleArn;
  }
}
