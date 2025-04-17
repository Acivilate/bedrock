import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { VPCStack } from '../lib/mt-vpc-stack';  // Import the VPC Stack
import { CognitoStack } from '../lib/mt-cognito-stack';  // Import the Cognito Stack
import { ChatbotBackendStack } from '../lib/chatbot-backend-stack';  // Import the Chatbot Backend Stack
import { DataStorageStack } from '../lib/mt-data-storage-stack';  // Import the Data Storage Stack
import { SharedResourcesStack } from '../lib/mt-shared-resources-stack';  // Import the Shared Resources Stack
import { ParameterStack } from '../parameters/parameters-stack';  // Import the Parameter Stack
import { ArtifactStage } from '../parameters/artifact-stage';  // Import ArtifactStage

export class MultiTenantPipeline extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the pipeline
    const pipeline = new CodePipeline(this, 'MultiTenantPipeline', {
      pipelineName: 'MultiTenantPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub('your-org/your-repo', 'main'),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    // Add stages to the pipeline
    this.addStages(pipeline);
  }

  private addStages(pipeline: CodePipeline) {
    const tenantId = 'tenantId';  // Replace with dynamic tenant ID or fetch as needed
    const env = 'dev';  // Replace with dynamic environment (e.g., dev, prod)

    // Stage 1: Artifact Stage (This should include the necessary synth steps)
    const artifactStage = new ArtifactStage(this, 'ArtifactStage', {
      env: env,
      tenantId: tenantId,
    });
    pipeline.addStage(artifactStage);  // Make sure ArtifactStage is added here

    // Stage 2: VPC Stack (VPC is always created first)
    const vpcStack = new VPCStack(this, 'VPCStack', {
      tenantId: tenantId,
      env: env,
    });
    
    // Create VPC stage
    const vpcStage = new cdk.Stage(this, 'VPCStage');
    vpcStack.node.addDependency(vpcStack); // Associate VPCStack with the VPCStage
    pipeline.addStage(vpcStage);  // Add VPCStage to the pipeline

    // Stage 3: Parameter Stack (deployed after VPC)
    const parameterStack = new ParameterStack(this, 'ParameterStack', {
      tenantId: tenantId,
      env: env,
    });

    // Create Parameter stage
    const parameterStage = new cdk.Stage(this, 'ParameterStage');
    parameterStack.node.addDependency(parameterStack);
    pipeline.addStage(parameterStage);

    // Stage 4: Cognito Stack (deployed after VPC and Parameter Stack)
    const cognitoStack = new CognitoStack(this, 'CognitoStack', {
      tenantId: tenantId,
      env: env,
    });

    // Create Cognito stage
    const cognitoStage = new cdk.Stage(this, 'CognitoStage');
    cognitoStack.node.addDependency(cognitoStack);
    pipeline.addStage(cognitoStage);

    // Stage 5: Chatbot Backend Stack (deployed after Cognito)
    const chatbotBackendStack = new ChatbotBackendStack(this, 'ChatbotBackendStack', {
      tenantId: tenantId,
      env: env,
    });

    // Create Chatbot Backend stage
    const chatbotBackendStage = new cdk.Stage(this, 'ChatbotBackendStage');
    chatbotBackendStack.node.addDependency(chatbotBackendStack);
    pipeline.addStage(chatbotBackendStage);

    // Stage 6: Data Storage Stack (deployed after Chatbot Backend)
    const dataStorageStack = new DataStorageStack(this, 'DataStorageStack', {
      tenantId: tenantId,
      env: env,
    });

    // Create Data Storage stage
    const dataStorageStage = new cdk.Stage(this, 'DataStorageStage');
    dataStorageStack.node.addDependency(dataStorageStack);
    pipeline.addStage(dataStorageStage);

    // Stage 7: Shared Resources Stack (deployed last)
    const sharedResourcesStack = new SharedResourcesStack(this, 'SharedResourcesStack', {
      tenantId: tenantId,
      env: env,
    });

    // Create Shared Resources stage
    const sharedResourcesStage = new cdk.Stage(this, 'SharedResourcesStage');
    sharedResourcesStack.node.addDependency(sharedResourcesStack);
    pipeline.addStage(sharedResourcesStage);
  }
}
