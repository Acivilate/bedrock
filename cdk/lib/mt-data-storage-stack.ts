import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DataStorageStack extends cdk.Stack {
  readonly chatS3BucketName: string;
  readonly chatDynamoDbTableName: string;

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts;  // Destructure tenantId and env from opts

    // S3 Bucket for storing files (e.g., VA forms, logs)
    this.chatS3BucketName = `${tenantId}-chat-bucket-${env}`; // Dynamically create the bucket name based on tenantId and env
    const chatS3Bucket = new s3.Bucket(this, `${tenantId}-ChatBucket-${env}`, {
      bucketName: this.chatS3BucketName,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY, // Delete bucket when stack is deleted (optional)
      lifecycleRules: [{
        enabled: true,
        expiration: cdk.Duration.days(365), // Files expire after 365 days
      }],
    });

    // DynamoDB Table for storing logs or chatbot query logs
    this.chatDynamoDbTableName = `${tenantId}-chatbot-query-logs-${env}`; // Dynamically create the table name
    const chatDynamoDbTable = new dynamodb.Table(this, `${tenantId}-ChatDynamoDbTable-${env}`, {
      tableName: this.chatDynamoDbTableName,
      partitionKey: { name: 'queryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY, // Delete table when stack is deleted (optional)
    });

    // Export resources for use in other stacks
    new ssm.StringParameter(this, `${tenantId}-ChatS3BucketNameParameter-${env}`, {
      parameterName: `/mypokket/s3/${tenantId}-${env}/bucket-name`,
      stringValue: chatS3Bucket.bucketName,
      description: 'Chat Bucket Name',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, `${tenantId}-ChatDynamoDbTableNameParameter-${env}`, {
      parameterName: `/mypokket/dynamodb/${tenantId}-${env}/table-name`,
      stringValue: chatDynamoDbTable.tableName,
      description: 'DynamoDB Table Name for SFTP logs',
      tier: ssm.ParameterTier.STANDARD,
    });

    // Outputs for use in other stacks
    new cdk.CfnOutput(this, `${tenantId}-ChatS3BucketNameOutput-${env}`, {
      value: chatS3Bucket.bucketName,
      description: 'The name of the S3 bucket for storing SFTP files',
      exportName: `${tenantId}-ChatS3BucketName-${env}`,
    });

    new cdk.CfnOutput(this, `${tenantId}-ChatDynamoDbTableNameOutput-${env}`, {
      value: chatDynamoDbTable.tableName,
      description: 'The name of the DynamoDB table for SFTP logs',
      exportName: `${tenantId}-SftpDynamoDbTableName-${env}`,
    });

    // Add resource exports to the export class as well
    this.chatS3BucketName = chatS3Bucket.bucketName;
    this.chatDynamoDbTableName = chatDynamoDbTable.tableName;
  }
}
