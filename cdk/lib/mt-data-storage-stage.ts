import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStorageStack } from './mt-data-storage-stack';  // Assuming the DataStorageStack is defined in a separate file

export type DataStorageStackOpts = {
  tenantId: string;
  env: string; // Environment (e.g., dev, prod)
}

export class DataStorageStage extends cdk.Stage {
  readonly chatS3BucketName: string;
  readonly chatDynamoDbTableName: string;

  constructor(scope: Construct, id: string, opts: DataStorageStackOpts, props?: cdk.StageProps) {
    super(scope, id, props);

    // Instantiate the DataStorageStack inside this stage
    const dataStorageStack = new DataStorageStack(this, `${opts.tenantId}-DataStorageStack-${opts.env}`, {
      tenantId: opts.tenantId,
      env: opts.env, // Pass the environment and tenantId as options
    });

    // Capture the outputs from the DataStorageStack for use in later stages or stacks
    this.chatS3BucketName = dataStorageStack.chatS3BucketName;
    this.chatDynamoDbTableName = dataStorageStack.chatDynamoDbTableName;
  }
}
