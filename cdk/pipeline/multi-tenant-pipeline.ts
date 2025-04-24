import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { MultiTenantStage } from '../lib/mt-infrastructure-stage';

export class MultiTenantPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the pipeline
    const pipeline = new CodePipeline(this, 'MultiTenantPipeline', {
      pipelineName: 'MultiTenantPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub('Acivilate/chatbot', 'main'),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    // Add stages to the pipeline
    this.addStages(pipeline);
  }

  private addStages(pipeline: CodePipeline) {
    const tenantId = 'tenantId';  
    const env = 'dev';  // (dev, prod)

    // Infrastructure Stage
    const multiTenantStage = new MultiTenantStage(this, 'MultiTenantStage', {
      tenantId: 'mt',
      env: env,
    });
    
    pipeline.addStage(multiTenantStage);
  }
}

