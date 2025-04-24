import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { CfnVPCGatewayAttachment, SecurityGroup, Peer, Port, Vpc, CfnNatGateway, CfnInternetGateway, CfnEIP, SubnetType } from 'aws-cdk-lib/aws-ec2';  // Importing the specific components you need
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class MultiTenantStack extends cdk.Stack {
    readonly vpc: Vpc;
    readonly securityGroup: SecurityGroup;
    readonly internetGateway: CfnInternetGateway;
    readonly natGateway: CfnNatGateway;
    readonly elasticIp: CfnEIP;
    readonly privateSubnetIds: string[];
    readonly publicSubnetIds: string[];

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts;

    // Create the VPC
    const vpc = new Vpc(this, `${tenantId}-vpc-${env}`, {
      maxAzs: 2, // Max 2 Availability Zones for high availability
      natGateways: 1, // 1 NAT Gateway for private subnets to access the internet
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Internet Gateway (for public subnets to access the internet)
    this.internetGateway = new cdk.aws_ec2.CfnInternetGateway(this, `${tenantId}-internet-gateway-${env}`, {
      tags: [
        { key: 'Name', value: `${tenantId}-internet-gateway-${env}` }
      ],
    });
    new CfnVPCGatewayAttachment(this, `${tenantId}-vpc-gateway-attachment-${env}`, {
      vpcId: vpc.vpcId,
      internetGatewayId: this.internetGateway.ref,
    });
    // Create NAT Gateway (for private subnets to access the internet)
    this.elasticIp = new CfnEIP(this, `${tenantId}-elastic-ip-${env}`, {
      domain: 'vpc',  // EIP for the NAT Gateway
    });

    this.natGateway = new CfnNatGateway(this, `${tenantId}-nat-gateway-${env}`, {
      allocationId: this.elasticIp.attrAllocationId,
      subnetId: vpc.publicSubnets[0].subnetId,
      tags: [
        { key: 'Name', value: `${tenantId}-nat-gateway-${env}` }
      ],
    });
    // Security Group (Lambda functions, API Gateway, etc)
    this.securityGroup = new SecurityGroup(this, `${tenantId}-security-group-${env}`, {
      vpc: vpc,
      description: 'Security group for Lambda functions or API Gateway',
    });

    // Allow all outbound traffic
    this.securityGroup.addEgressRule(Peer.anyIpv4(), Port.allTcp(), 'Allow all outbound traffic');

    // Allow inbound HTTP (port 80) and HTTPS (port 443) traffic for public services
    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP access');
    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS access');

    // Create Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${tenantId}-user-pool-${env}`,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
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
        phoneNumber: true, 
      }),
    });

    // Create Cognito Identity Pool (for federated identities)
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${tenantId}-identity-pool-${env}`,
      allowUnauthenticatedIdentities: false,  
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // IAM Role for unauthenticated users
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

    // IAM Role for authenticated users
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

    // Create S3 Bucket
    const chatS3Bucket = new s3.Bucket(this, `${tenantId}-ChatBucket-${env}`, {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create DynamoDB Table
    const chatDynamoDbTable = new dynamodb.Table(this, `${tenantId}-ChatDynamoDb-${env}`, {
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda Execution Role
    const lambdaExecutionRole = new iam.Role(this, `${tenantId}-LambdaExecutionRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
      ],
    });

    // Create Lambda function
    const chatbotLambda = new lambda.Function(this, `${tenantId}-ChatbotLambda-${env}`, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./lambdas'),
      environment: {
        VPC_ID: vpc.vpcId,
        S3_BUCKET_NAME: chatS3Bucket.bucketName,
        DYNAMO_TABLE_NAME: chatDynamoDbTable.tableName,
      },
      role: lambdaExecutionRole,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Add the event notification to trigger Lambda when a file is uploaded to the S3 bucket
    chatS3Bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(chatbotLambda)
    );

    // Grant Lambda permissions to read from the S3 bucket
    chatS3Bucket.grantRead(chatbotLambda);

    // IAM Role for API Gateway access** (API Gateway interacting with Lambda)
    const apiGatewayExecutionRole = new iam.Role(this, `${tenantId}-ApiGatewayExecutionRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayInvokeFullAccess'),
      ],
    });
    // CloudWatch Log Group** (For logging Lambda function executions)
    const logGroup = new LogGroup(this, `${tenantId}-SharedLogGroup-${env}`, {
      logGroupName: `/aws/lambda/${tenantId}-shared-log-group-${env}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Delete when the stack is deleted
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, `${tenantId}-ChatbotApi-${env}`, {
      restApiName: 'Chatbot API',
      description: 'API for interacting with the chatbot',
    });

    // API resource
    const chatbotResource = api.root.addResource('chatbot');
    chatbotResource.addMethod('POST', new apigateway.LambdaIntegration(chatbotLambda));

    //  Outputs for use in other stacks
    new cdk.CfnOutput(this, `${tenantId}-VpcId-${env}`, {
      value: vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${tenantId}-VpcId-${env}`,
    });
    new cdk.CfnOutput(this, `${tenantId}-SecurityGroupId-${env}`, {
      value: this.securityGroup.securityGroupId,
      description: 'The ID of the Security Group',
      exportName: `${tenantId}-SecurityGroupId-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-InternetGatewayId-${env}`, {
      value: this.internetGateway.ref,
      description: 'The ID of the Internet Gateway',
      exportName: `${tenantId}-InternetGatewayId-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-NatGatewayId-${env}`, {
      value: this.natGateway.ref,
      description: 'The ID of the NAT Gateway',
      exportName: `${tenantId}-NatGatewayId-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ElasticIp-${env}`, {
      value: this.elasticIp.ref,
      description: 'The Elastic IP for the NAT Gateway',
      exportName: `${tenantId}-ElasticIp-${env}`,  
    });

    console.log('Public Subnets:', vpc.publicSubnets.map(subnet => subnet.subnetId));

    console.log('Private Subnets:', vpc.privateSubnets.map(subnet => subnet.subnetId));

    // Public Subnet IDs Output (if needed)
    new cdk.CfnOutput(this, `${tenantId}-VpcPublicSubnetIds-${env}`, {
      value: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'The IDs of the public subnets',
      exportName: `${tenantId}-VpcPublicSubnetIds-${env}`,
    });

    // First Private Subnet IDs Output
    new cdk.CfnOutput(this, `${tenantId}-VpcPrivateSubnet1Id-${env}`, {
      value: vpc.privateSubnets[0].subnetId,
      description: 'The ID of the first private subnet',
      exportName: `${tenantId}-VpcPrivateSubnet1Id-${env}`,  
    });

    // Second Private Subnet IDs Output
    new cdk.CfnOutput(this, `${tenantId}-VpcPrivateSubnet2Id-${env}`, {
      value: vpc.privateSubnets[1].subnetId,
      description: 'The ID of the second private subnet',
      exportName: `${tenantId}-VpcPrivateSubnet2Id-${env}`,  
    });

    // Outputs for other stacks to use
    new cdk.CfnOutput(this, `${tenantId}-UserPoolId-${env}`, {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${tenantId}-UserPoolId-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-UserPoolArn-${env}`, {
      value: userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${tenantId}-UserPoolArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-IdentityPoolId-${env}`, {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${tenantId}-IdentityPoolId-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-CognitoUserPoolName-${env}`, {
      value: `${tenantId}-user-pool-${env}`,
      description: 'Cognito User Pool Name',
      exportName: `${tenantId}-CognitoUserPoolName-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-UnauthenticatedRoleArn-${env}`, {
      value: unauthRole.roleArn,
      description: 'IAM Role ARN for unauthenticated users',
      exportName: `${tenantId}-UnauthenticatedRoleArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-AuthenticatedRoleArn-${env}`, {
      value: authRole.roleArn,
      description: 'IAM Role ARN for authenticated users',
      exportName: `${tenantId}-AuthenticatedRoleArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ChatbotLambdaArn-${env}`, {
      value: chatbotLambda.functionArn,
      description: 'Lambda ARN for the chatbot function',
      exportName: `${tenantId}-ChatbotLambdaArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ApiGatewayExecutionRoleArnOutput-${env}`, {
      value: apiGatewayExecutionRole.roleArn,
      description: 'API Gateway Execution Role ARN',
      exportName: `${tenantId}-ApiGatewayExecutionRoleArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-LogGroupArnOutput-${env}`, {
      value: logGroup.logGroupArn,
      description: 'CloudWatch Log Group ARN for Lambda logs',
      exportName: `${tenantId}-LogGroupArn-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ChatS3BucketName-${env}`, {
      value: chatS3Bucket.bucketName,
      description: 'The name of the S3 bucket for chatbot data',
      exportName: `${tenantId}-ChatS3BucketName-${env}`
    });

    new cdk.CfnOutput(this, `${tenantId}-ChatDynamoDb-${env}`, {
      value: chatDynamoDbTable.tableName,
      description: 'The name of the DynamoDB table for chatbot logs',
      exportName: `${tenantId}-ChatDynamoDb-${env}`
    });
  }
};