import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';

export class CognitoStack extends cdk.Stack {
  readonly userPoolId: string;
  readonly userPoolArn: string;
  readonly identityPoolId: string;
  readonly userPoolName: string;
  readonly unauthRoleArn: string; // Exported for future use
  readonly authRoleArn: string;  // Exported for future use

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts;  // Destructure tenantId and env from opts

    // Create Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
        userPoolName: `${tenantId}-user-pool-${env}`,
        signInAliases: { email: true }, // Users can sign in using their email
        autoVerify: { email: true },  // Automatically verify email during sign-up
        mfa: cognito.Mfa.OPTIONAL,  // MFA is optional
        removalPolicy: RemovalPolicy.DESTROY, // Set to DESTROY in dev environment
      });
  
      // Create Cognito User Pool Client
      const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
        userPool: userPool,
        generateSecret: false, // No client secret
        refreshTokenValidity: cdk.Duration.days(30), // Token validity
        writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
          phoneNumber: true, // Include phone number in the attributes
        }),
      });
  
      // Create Cognito Identity Pool (for federated identities)
      const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
        identityPoolName: `${tenantId}-identity-pool-${env}`,
        allowUnauthenticatedIdentities: true,  // Allow unauthenticated users
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      });
  
      // IAM Role for unauthenticated users (allowing very limited access)
      const unauthRole = new iam.Role(this, 'UnauthenticatedRole', {
        assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
          'StringEquals': {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        }),
      });
  
      unauthRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
        resources: ['*'],
      }));
  
      // IAM Role for authenticated users (allowing more access)
      const authRole = new iam.Role(this, 'AuthenticatedRole', {
        assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
          'StringEquals': {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        }),
      });
  
      authRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
        resources: ['*'],
      }));
  
      // Attach IAM roles to Identity Pool
      new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: unauthRole.roleArn,
          authenticated: authRole.roleArn,
        },
      });
  
      // Outputs for other stacks to use
      new CfnOutput(this, 'UserPoolId', {
        value: userPool.userPoolId,
        description: 'Cognito User Pool ID',
        exportName: `${tenantId}-UserPoolId-${env}`,
      });
  
      new CfnOutput(this, 'UserPoolArn', {
        value: userPool.userPoolArn,
        description: 'Cognito User Pool ARN',
        exportName: `${tenantId}-UserPoolArn-${env}`,
      });
  
      new CfnOutput(this, 'IdentityPoolId', {
        value: identityPool.ref,
        description: 'Cognito Identity Pool ID',
        exportName: `${tenantId}-IdentityPoolId-${env}`,
      });
  
      // Export User Pool Name for use in other stacks
      new CfnOutput(this, 'CognitoUserPoolName', {
        value: `${tenantId}-user-pool-${env}`,
        description: 'Cognito User Pool Name',
        exportName: `${tenantId}-CognitoUserPoolName-${env}`,
      });
  
      // Export IAM Role ARNs for use in other stacks
      new CfnOutput(this, 'UnauthenticatedRoleArn', {
        value: unauthRole.roleArn,
        description: 'IAM Role ARN for unauthenticated users',
        exportName: `${tenantId}-UnauthenticatedRoleArn-${env}`,
      });
  
      new CfnOutput(this, 'AuthenticatedRoleArn', {
        value: authRole.roleArn,
        description: 'IAM Role ARN for authenticated users',
        exportName: `${tenantId}-AuthenticatedRoleArn-${env}`,
      });
  
      // Return important values
      this.userPoolId = userPool.userPoolId;
      this.userPoolArn = userPool.userPoolArn;
      this.identityPoolId = identityPool.ref;
      this.userPoolName = `${tenantId}-user-pool-${env}`; // Dynamic naming based on environment
      this.unauthRoleArn = unauthRole.roleArn;
      this.authRoleArn = authRole.roleArn;
    }
  }
