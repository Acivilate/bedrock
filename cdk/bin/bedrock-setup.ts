#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MultiTenantStack } from '../lib/mt-infrastructure-stack';
import { OpenSearchStack } from '../lib/opensearch-stack';
import { BedrockStack } from '../lib/bedrock-stack';

const app = new cdk.App();

 // Instantiate the VPCStack
 const vpcStack = new MultiTenantStack(app, 'VPCStack', {
    env: {
        account: '986437037830', //process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
      }
  });

// Deploy OpenSearch Stack first
const opensearchStack = new OpenSearchStack(app, 'OpenSearchStack', {
  env: {
    account: '986437037830', //process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
});

// Deploy Bedrock Stack second
const bedrockStack = new BedrockStack(app, 'BedrockStack', {
  env: {
    account: '986437037830', //process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
