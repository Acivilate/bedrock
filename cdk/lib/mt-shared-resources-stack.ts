import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class SharedResourcesStack extends cdk.Stack {
  readonly lambdaExecutionRole: iam.Role;
  readonly apiGatewayExecutionRole: iam.Role;
  readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts; // Destructure tenantId and env from opts

    // IAM Role for Lambda execution** (Generic for Lambda functions)
    this.lambdaExecutionRole = new iam.Role(this, `${tenantId}-LambdaExecutionRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),  // For basic Lambda execution
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),  // Full access to S3 (modify as needed)
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'), // Full access to DynamoDB (modify as needed)
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'), // If Lambda will invoke API Gateway
      ],
    });

    // IAM Role for API Gateway access** (API Gateway interacting with Lambda)
    this.apiGatewayExecutionRole = new iam.Role(this, `${tenantId}-ApiGatewayExecutionRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayInvokeFullAccess'),
      ],
    });

    // CloudWatch Log Group** (For logging Lambda function executions)
    this.logGroup = new logs.LogGroup(this, `${tenantId}-SharedLogGroup-${env}`, {
      logGroupName: `/aws/lambda/${tenantId}-shared-log-group-${env}`,
      removalPolicy: RemovalPolicy.DESTROY, // This will delete the log group when the stack is deleted
    });

    // Store Lambda Role ARN as SSM Parameter** (for use in other stacks)
    new ssm.StringParameter(this, `${tenantId}-LambdaExecutionRoleArn-${env}`, {
      parameterName: `/mypokket/${tenantId}/${env}/lambda-execution-role-arn`,
      stringValue: this.lambdaExecutionRole.roleArn,
      description: 'ARN of the Lambda Execution Role',
      tier: ssm.ParameterTier.STANDARD,
    });

    // Output the IAM Role ARN and Log Group ARN for other stacks to use**
    new cdk.CfnOutput(this, `${tenantId}-LambdaExecutionRoleArnOutput-${env}`, {
      value: this.lambdaExecutionRole.roleArn,
      description: 'Lambda Execution Role ARN',
      exportName: `${tenantId}-LambdaExecutionRoleArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ApiGatewayExecutionRoleArnOutput-${env}`, {
      value: this.apiGatewayExecutionRole.roleArn,
      description: 'API Gateway Execution Role ARN',
      exportName: `${tenantId}-ApiGatewayExecutionRoleArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-LogGroupArnOutput-${env}`, {
      value: this.logGroup.logGroupArn,
      description: 'CloudWatch Log Group ARN for Lambda logs',
      exportName: `${tenantId}-LogGroupArn-${env}`,
    });
  }
}
