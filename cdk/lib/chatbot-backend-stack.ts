import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Fn } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export class ChatbotBackendStack extends cdk.Stack {
  readonly chatbotLambdaArn: string;
  readonly chatbotApiUrl: string;
  readonly vpcId: string;
  readonly securityGroupId: string;
  readonly privateSubnetIds: string[];

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts;  // Destructure tenantId and env from opts

    // Import VPC and other resources from the Parameter Stack
    this.vpcId = Fn.importValue(`${tenantId}-VpcId-${env}`);
    this.securityGroupId = Fn.importValue(`${tenantId}-SecurityGroupId-${env}`);
    this.privateSubnetIds = Fn.importValue(`${tenantId}-VpcPrivateSubnetIds-${env}`).split(',');

    // Define Lambda execution role
    const lambdaRole = new iam.Role(this, `${tenantId}-ChatbotLambdaRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),  // For S3 access
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'), // For DynamoDB access
      ],
    });

    // Create Lambda function to handle chatbot queries
    const chatbotLambda = new lambda.Function(this, `${tenantId}-ChatbotLambda-${env}`, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('path-to-lambda-code'),
      environment: {
        VPC_ID: this.vpcId,
        SECURITY_GROUP_ID: this.securityGroupId,
        SUBNET_IDS: this.privateSubnetIds.join(','),  // Join the private subnet IDs into a string for the Lambda environment variable
      },
      role: lambdaRole,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      vpc: Vpc.fromVpcAttributes(this, `${tenantId}-ImportedVPC-${env}`, {
        vpcId: this.vpcId,
        availabilityZones: ['us-east-1a', 'us-east-1b'],  // Adjust these based on your region
        privateSubnetIds: this.privateSubnetIds,
      }),
    });

    // Create API Gateway to expose the Lambda function
    const api = new apigateway.RestApi(this, `${tenantId}-ChatbotApi-${env}`, {
      restApiName: 'Chatbot API',
      description: 'API for interacting with the chatbot',
    });

    // Create an API resource for chatbot interaction
    const chatbotResource = api.root.addResource('chatbot');
    chatbotResource.addMethod('POST', new apigateway.LambdaIntegration(chatbotLambda));

    // Store the API Gateway URL in SSM for use in other parts of the system
    new ssm.StringParameter(this, `${tenantId}-ChatbotApiUrl-${env}`, {
      parameterName: `/chatbot-api-url/${tenantId}-${env}`,
      stringValue: api.url!,
      description: 'URL of the Chatbot API',
      tier: ssm.ParameterTier.STANDARD,
    });

    // Outputs for use in other stacks
    this.chatbotApiUrl = api.url!;
    this.chatbotLambdaArn = chatbotLambda.functionArn;

    new cdk.CfnOutput(this, `${tenantId}-ChatbotApiUrl-${env}`, {
      value: this.chatbotApiUrl,
      description: 'URL for the Chatbot API',
      exportName: `${tenantId}-ChatbotApiUrl-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ChatbotLambdaArn-${env}`, {
      value: this.chatbotLambdaArn,
      description: 'ARN of the Chatbot Lambda function',
      exportName: `${tenantId}-ChatbotLambdaArn-${env}`,
    });
  }
}
