import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ChatbotBackendStack } from './chatbot-backend-stack'; // Assuming the ChatbotBackendStack is defined in a separate file

export class ChatbotBackendStage extends cdk.Stage {
    readonly chatbotApiUrl: string;
    readonly chatbotLambdaArn: string;
  
    constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StageProps) {
      super(scope, id, props);
  
      // Instantiate the ChatbotBackendStack
      const chatbotBackendStack = new ChatbotBackendStack(this, `${opts.tenantId}-ChatbotBackendStack-${opts.env}`, {
        tenantId: opts.tenantId,
        env: opts.env, // Pass the environment and tenantId as options
      });
  
      // Directly access the outputs as class properties
      this.chatbotApiUrl = chatbotBackendStack.chatbotApiUrl;
      this.chatbotLambdaArn = chatbotBackendStack.chatbotLambdaArn;
    }
  }
  
