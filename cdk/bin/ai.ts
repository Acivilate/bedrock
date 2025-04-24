#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from 'aws-cdk-lib';
import { MultiTenantPipelineStack } from '../pipeline/multi-tenant-pipeline';
// import dotenv from '../../dotenv';

const app = new cdk.App();
new MultiTenantPipelineStack(app, "MultiTenantPipelineStack", {
   env: { account: process.env.AWS_ACCOUNT, region: process.env.AWS_EAST_REGION},
});