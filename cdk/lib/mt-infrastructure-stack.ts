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
import { CONFIG } from './config';

export class MultiTenantStack extends cdk.Stack {
    readonly vpc: Vpc;
    readonly securityGroup: SecurityGroup;
    readonly internetGateway: CfnInternetGateway;
    readonly natGateway: CfnNatGateway;
    readonly elasticIp: CfnEIP;
    readonly privateSubnetIds: string[];
    readonly publicSubnetIds: string[];
    readonly userPool: cognito.UserPool;
    readonly identityPool: cognito.CfnIdentityPool
    readonly unauthRole: iam.Role;
    readonly authRole: iam.Role;
    readonly chatS3Bucket: s3.Bucket;
    readonly chatDynamoDbTable: dynamodb.Table;
    readonly chatbotLambda: lambda.Function;
    readonly apiGatewayExecutionRole: iam.Role;
    readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the VPC
    const vpc = new Vpc(this, 'VPC', {
      vpcName: `${CONFIG.tenantId}-vpc-${CONFIG.env}`,
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

    // // Internet Gateway (for public subnets to access the internet)
    // this.internetGateway = new cdk.aws_ec2.CfnInternetGateway(this, 'Internet-Gateway', {
    //   tags: [
    //     { key: 'Name', value: `${CONFIG.tenantId}-internet-gateway-${CONFIG.env}` }
    //   ],
    // });

    // new CfnVPCGatewayAttachment(this, 'VPCGatewayAttachment', {
    //   vpcId: vpc.vpcId,
    //   internetGatewayId: this.internetGateway.ref,
    // });

    // Create NAT Gateway (for private subnets to access the internet)
    this.elasticIp = new CfnEIP(this, 'ElasticIp', {
      domain: 'vpc',  // EIP for the NAT Gateway
      tags: [
        { key: 'Name', value: `${CONFIG.tenantId}-elasticIp-${CONFIG.env}` }
      ],
    });

    this.natGateway = new CfnNatGateway(this, 'NatGateway', {
      allocationId: this.elasticIp.attrAllocationId,
      subnetId: vpc.publicSubnets[0].subnetId,
      tags: [
        { key: 'Name', value: `${CONFIG.tenantId}-nat-gateway-${CONFIG.env}` }
      ],
    });
    // Security Group (Lambda functions, API Gateway, etc)
    this.securityGroup = new SecurityGroup(this, 'VPCSecurityGroup', {
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
      userPoolName: `${CONFIG.tenantId}-user-pool-${CONFIG.env}`,
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
      identityPoolName: `${CONFIG.tenantId}-identity-pool-${CONFIG.env}`,
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
      roleName: `${CONFIG.tenantId}-unauthRole-${CONFIG.env}`,
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
      roleName: `${CONFIG.tenantId}-authRole-${CONFIG.env}`,
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
    const chatS3Bucket = new s3.Bucket(this, 'ChatS3Bucket', {
      bucketName: `${CONFIG.tenantId}-chat-bucket-${CONFIG.env}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create DynamoDB Table
    const chatDynamoDbTable = new dynamodb.Table(this, `${CONFIG.tenantId}-ChatDynamoDb-${CONFIG.env}`, {
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda Execution Role
    const lambdaExecutionRole = new iam.Role(this, `${CONFIG.tenantId}-LambdaExecutionRole-${CONFIG.env}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
      ],
      inlinePolicies: {
        NetworkInterfacePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'ec2:CreateNetworkInterface',
                'ec2:DescribeNetworkInterfaces',
                'ec2:DeleteNetworkInterface',
              ],
              resources: ['*'], // You can limit the resources if needed
            }),
          ],
        }),
      },
    });

    // Create Lambda function
    const chatbotLambda = new lambda.Function(this, `${CONFIG.tenantId}-ChatbotLambda-${CONFIG.env}`, {
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
    const apiGatewayExecutionRole = new iam.Role(this, `${CONFIG.tenantId}-ApiGatewayExecutionRole-${CONFIG.env}`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      inlinePolicies: {
        ApiGatewayInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'execute-api:Invoke',
              ],
              resources: ['*'], // You can restrict the resource ARN if needed
            }),
          ],
        }),
      },
    });
    
    // const apiGatewayExecutionRole = new iam.Role(this, `${CONFIG.tenantId}-ApiGatewayExecutionRole-${CONFIG.env}`, {
    //   assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    //   managedPolicies: [
    //     iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayInvokeFullAccess'),
    //   ],
    // });
    // CloudWatch Log Group** (For logging Lambda function executions)
    const logGroup = new LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${CONFIG.tenantId}-shared-log-group-${CONFIG.env}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Delete when the stack is deleted
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'API-Gateway', {
      restApiName: `${CONFIG.tenantId}-ChatbotApi-${CONFIG.env}`,
      description: 'API for interacting with the chatbot',
    });

    // API resource
    const chatbotResource = api.root.addResource('chatbot');
    chatbotResource.addMethod('POST', new apigateway.LambdaIntegration(chatbotLambda));

    //  Outputs for use in other stacks
    new cdk.CfnOutput(this, 'VpcIdOutput', {
      value: vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: 'VpcIdOutput',
    });

    new cdk.CfnOutput(this, 'SecurityGroupIdOutput', {
      value: this.securityGroup.securityGroupId,
      description: 'The ID of the Security Group',
      exportName: 'SecurityGroupIdOutput',
    });

    // new cdk.CfnOutput(this, 'InternetGatewayIdOutput', {
    //   value: this.internetGateway.ref,
    //   description: 'The ID of the Internet Gateway',
    //   exportName: 'InternetGatewayIdOutput',
    // });

    new cdk.CfnOutput(this, 'NatGatewayIdOutput', {
      value: this.natGateway.ref,
      description: 'The ID of the NAT Gateway',
      exportName: 'NatGatewayIdOutput',
    });

    new cdk.CfnOutput(this, 'ElasticIpOutput', {
      value: this.elasticIp.ref,
      description: 'The Elastic IP for the NAT Gateway',
      exportName: 'ElasticIpOutput',  
    });

    console.log('Public Subnets:', vpc.publicSubnets.map(subnet => subnet.subnetId));

    console.log('Private Subnets:', vpc.privateSubnets.map(subnet => subnet.subnetId));

    // Public Subnet IDs Output (if needed)
    new cdk.CfnOutput(this, 'VpcPublicSubnetIdsOutput', {
      value: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'The IDs of the public subnets',
      exportName: 'VpcPublicSubnetIds',
    });

    // First Private Subnet IDs Output
    new cdk.CfnOutput(this, 'VpcPrivateSubnet1IdOutput', {
      value: vpc.privateSubnets[0].subnetId,
      description: 'The ID of the first private subnet',
      exportName: 'VpcPrivateSubnet1Id',  
    });

    // Second Private Subnet IDs Output
    new cdk.CfnOutput(this, 'VpcPrivateSubnet2IdOutput', {
      value: vpc.privateSubnets[1].subnetId,
      description: 'The ID of the second private subnet',
      exportName: 'VpcPrivateSubnet2Id',  
    });

    // Outputs for other stacks to use
    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArnOutput', {
      value: userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'UserPoolArn',
    });

    new cdk.CfnOutput(this, 'IdentityPoolIdOutput', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: 'IdentityPoolId',
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolNameOutput', {
      value: identityPool.attrName,
      description: 'Cognito User Pool Name',
      exportName: 'CognitoUserPoolName',
    });

    new cdk.CfnOutput(this, 'UnauthenticatedRoleArnOutput', {
      value: unauthRole.roleArn,
      description: 'IAM Role ARN for unauthenticated users',
      exportName: 'UnauthenticatedRoleArn',
    });

    new cdk.CfnOutput(this, 'AuthenticatedRoleArnOutput', {
      value: authRole.roleArn,
      description: 'IAM Role ARN for authenticated users',
      exportName: 'AuthenticatedRoleArn',
    });

    new cdk.CfnOutput(this, 'ChatbotLambdaArnOutput', {
      value: chatbotLambda.functionArn,
      description: 'Lambda ARN for the chatbot function',
      exportName: 'ChatbotLambdaArn',
    });

    new cdk.CfnOutput(this, 'ApiGatewayExecutionRoleArnOutput', {
      value: apiGatewayExecutionRole.roleArn,
      description: 'API Gateway Execution Role ARN',
      exportName: 'ApiGatewayExecutionRoleArn',
    });

    new cdk.CfnOutput(this, 'LogGroupArnOutput', {
      value: logGroup.logGroupArn,
      description: 'CloudWatch Log Group ARN for Lambda logs',
      exportName: 'LogGroupArn',
    });

    new cdk.CfnOutput(this, 'ChatS3BucketNameOutput', {
      value: chatS3Bucket.bucketName,
      description: 'The name of the S3 bucket for chatbot data',
      exportName: 'ChatS3BucketName',
    });

    new cdk.CfnOutput(this, 'ChatS3BucketArnOutput', {
      value: chatS3Bucket.bucketArn,
      description: 'ARN of the S3 bucket for chatbot data',
      exportName: 'ChatS3BucketArnOutput',
    });

    new cdk.CfnOutput(this, 'ChatDynamoDbTableNameOutput', {
      value: chatDynamoDbTable.tableName,
      description: 'The name of the DynamoDB table for chatbot logs',
      exportName: 'ChatDynamoDbTableNameOutput',
    });
  }
};