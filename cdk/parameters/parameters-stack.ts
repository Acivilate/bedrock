import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { Env } from "../types/types";

export type ParameterStackOpts = {
  tenantId: string;
  env: Env;
};

export class ParameterStack extends cdk.Stack {
  readonly vpcIdName: string;
  readonly securityGroupIdName: string;
  readonly internetGatewayIdName: string;
  readonly natGatewayIdName: string;
  readonly elasticIpName: string;
  readonly vpcPrivateSubnetIdsName: string;
  readonly vpcPublicSubnetIdsName: string;
  readonly chatbotApiUrlName: string;
  readonly chatbotLambdaArnName: string;
  readonly userPoolIdName: string;
  readonly userPoolArnName: string;
  readonly identityPoolIdName: string;
  readonly unauthRoleArnName: string;
  readonly authRoleArnName: string;
  readonly chatS3BucketName: string;
  readonly chatDynamoDbTableName: string;
  readonly lambdaExecutionRoleArnName: string;
  readonly apiGatewayExecutionRoleArnName: string;
  readonly logGroupArnName: string;

  constructor(
    scope: Construct,
    id: string,
    opts: ParameterStackOpts,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const { tenantId, env } = opts; // Destructure env from opts

    // VPC
    this.vpcIdName = `/chatbot/vpc/${env}/vpcId`;
    const vpcIdName = new ssm.StringParameter(this, "VpcIdParam", {
      parameterName: this.vpcIdName,
      stringValue: `${tenantId}-VpcId-${env}`,
      description: "VPC ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(vpcIdName).add("env", opts.env);

    this.securityGroupIdName = `/chatbot/vpc/${env}/securityGroupId`;
    const securityGroupIdName = new ssm.StringParameter(this, "SecurityGroupIdParam", {
      parameterName: this.securityGroupIdName,
      stringValue: `${tenantId}-SecurityGroupId-${env}`,
      description: "Security Group ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(securityGroupIdName).add("env", opts.env);

    this.internetGatewayIdName = `/chatbot/vpc/${env}/internetGatewayId`;
    const internetGatewayIdName = new ssm.StringParameter(this, "InternetGatewayIdParam", {
      parameterName: this.internetGatewayIdName,
      stringValue: `${tenantId}-InternetGatewayId-${env}`,
      description: "Internet Gateway ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(internetGatewayIdName).add("env", opts.env);

    this.natGatewayIdName = `/chatbot/vpc/${env}/natGatewayId`;
    const natGatewayIdName = new ssm.StringParameter(this, "NatGatewayIdParam", {
      parameterName: this.natGatewayIdName,
      stringValue: `${tenantId}-NatGatewayId-${env}`,
      description: "NAT Gateway ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(natGatewayIdName).add("env", opts.env);

    this.elasticIpName = `/chatbot/vpc/${env}/elasticIp`;
    const elasticIpName = new ssm.StringParameter(this, "ElasticIpParam", {
      parameterName: this.elasticIpName,
      stringValue: `${tenantId}-ElasticIp-${env}`,
      description: "Elastic IP",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(elasticIpName).add("env", opts.env);

    this.vpcPrivateSubnetIdsName = `/chatbot/vpc/${env}/privateSubnetIds`;
    const vpcPrivateSubnetIdsName = new ssm.StringParameter(this, "VpcPrivateSubnetIdsParam", {
      parameterName: this.vpcPrivateSubnetIdsName,
      stringValue: `${tenantId}-VpcPrivateSubnetIds-${env}`,
      description: "Private Subnet IDs",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(vpcPrivateSubnetIdsName).add("env", opts.env);

    this.vpcPublicSubnetIdsName = `/chatbot/vpc/${env}/publicSubnetIds`;
    const vpcPublicSubnetIdsName = new ssm.StringParameter(this, "VpcPublicSubnetIdsParam", {
      parameterName: this.vpcPublicSubnetIdsName,
      stringValue: `${tenantId}-VpcPublicSubnetIds-${env}`,
      description: "Public Subnet IDs",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(vpcPublicSubnetIdsName).add("env", opts.env);

    // Chatbot Resources
    this.chatbotApiUrlName = `/chatbot/chatbot/${env}/apiUrl`;
    const chatbotApiUrlName = new ssm.StringParameter(this, "ChatbotApiUrlParam", {
      parameterName: this.chatbotApiUrlName,
      stringValue: `${tenantId}-ChatbotApiUrl-${env}`,
      description: "Chatbot API URL",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(chatbotApiUrlName).add("env", opts.env);

    this.chatbotLambdaArnName = `/chatbot/chatbot/${env}/lambdaArn`;
    const chatbotLambdaArnName = new ssm.StringParameter(this, "ChatbotLambdaArnParam", {
      parameterName: this.chatbotLambdaArnName,
      stringValue: `${tenantId}-ChatbotLambdaArn-${env}`,
      description: "Chatbot Lambda ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(chatbotLambdaArnName).add("env", opts.env);

    // Cognito
    this.userPoolIdName = `/chatbot/cognito/${env}/userPoolId`;
    const userPoolIdName = new ssm.StringParameter(this, "UserPoolIdParam", {
      parameterName: this.userPoolIdName,
      stringValue: `${tenantId}-UserPoolId-${env}`,
      description: "Cognito User Pool ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(userPoolIdName).add("env", opts.env);

    this.userPoolArnName = `/chatbot/cognito/${env}/userPoolArn`;
    const userPoolArnName = new ssm.StringParameter(this, "UserPoolArnParam", {
      parameterName: this.userPoolArnName,
      stringValue: `${tenantId}-UserPoolArn-${env}`,
      description: "Cognito User Pool ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(userPoolArnName).add("env", opts.env);

    this.identityPoolIdName = `/chatbot/cognito/${env}/identityPoolId`;
    const identityPoolIdName = new ssm.StringParameter(this, "IdentityPoolIdParam", {
      parameterName: this.identityPoolIdName,
      stringValue: `${tenantId}-IdentityPoolId-${env}`,
      description: "Cognito Identity Pool ID",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(identityPoolIdName).add("env", opts.env);

    this.unauthRoleArnName = `/chatbot/cognito/${env}/unauthRoleArn`;
    const unauthRoleArnName = new ssm.StringParameter(this, "UnauthRoleArnParam", {
      parameterName: this.unauthRoleArnName,
      stringValue: `${tenantId}-UnauthRoleArn-${env}`,
      description: "Cognito Unauthenticated Role ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(unauthRoleArnName).add("env", opts.env);

    this.authRoleArnName = `/chatbot/cognito/${env}/authRoleArn`;
    const authRoleArnName = new ssm.StringParameter(this, "AuthRoleArnParam", {
      parameterName: this.authRoleArnName,
      stringValue: `${tenantId}-AuthRoleArn-${env}`,
      description: "Cognito Authenticated Role ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(authRoleArnName).add("env", opts.env);

    // Data Storage (S3, Dynamdb, RDS?)
    this.chatS3BucketName = `/chatbot/chat/${env}/s3BucketName`;
    const chatS3BucketName = new ssm.StringParameter(this, "ChatS3BucketNameParam", {
      parameterName: this.chatS3BucketName,
      stringValue: `${tenantId}-ChatS3BucketName-${env}`,
      description: "Chat S3 Bucket Name",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(chatS3BucketName).add("env", opts.env);

    this.chatDynamoDbTableName = `/chatbot/sftp/${env}/dynamoDbTableName`;
    const chatDynamoDbTableName = new ssm.StringParameter(this, "ChatDynamoDbTableNameParam", {
      parameterName: this.chatDynamoDbTableName,
      stringValue: `${tenantId}-SftpDynamoDbTableName-${env}`,
      description: "SFTP DynamoDB Table Name",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(chatDynamoDbTableName).add("env", opts.env);

    // Shared Resources (Roles and Policies?)
    this.lambdaExecutionRoleArnName = `/chatbot/shared/${env}/lambdaExecutionRoleArn`;
    const lambdaExecutionRoleArnName = new ssm.StringParameter(this, "LambdaExecutionRoleArnParam", {
      parameterName: this.lambdaExecutionRoleArnName,
      stringValue: `${tenantId}-LambdaExecutionRoleArn-${env}`,
      description: "Lambda Execution Role ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(lambdaExecutionRoleArnName).add("env", opts.env);

    this.apiGatewayExecutionRoleArnName = `/chatbot/shared/${env}/apiGatewayExecutionRoleArn`;
    const apiGatewayExecutionRoleArnName = new ssm.StringParameter(this, "ApiGatewayExecutionRoleArnParam", {
      parameterName: this.apiGatewayExecutionRoleArnName,
      stringValue: `${tenantId}-ApiGatewayExecutionRoleArn-${env}`,
      description: "API Gateway Execution Role ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(apiGatewayExecutionRoleArnName).add("env", opts.env);

    this.logGroupArnName = `/chatbot/shared/${env}/logGroupArn`;
    const logGroupArnName = new ssm.StringParameter(this, "LogGroupArnParam", {
      parameterName: this.logGroupArnName,
      stringValue: `${tenantId}-LogGroupArn-${env}`,
      description: "CloudWatch Log Group ARN",
      tier: ssm.ParameterTier.STANDARD,
    });
    cdk.Tags.of(logGroupArnName).add("env", opts.env);
  }
}
