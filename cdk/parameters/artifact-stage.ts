import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ParameterStack } from "./parameters-stack"; // Import the ParameterStack to get parameter values
import { Env } from "../types/types"; // Make sure to import your Env type

export type ArtifactStageOpts = {
  env: Env; // The environment (dev, prod, etc.)
  tenantId: string; // The tenant ID to associate with each resource
};

export class ArtifactStage extends cdk.Stage {
  readonly VpcIdParam: string;
  readonly SecurityGroupIdParam: string;
  readonly InternetGatewayIdParam: string;
  readonly NatGatewayIdParam: string;
  readonly ElasticIpParam: string;
  readonly VpcPrivateSubnetIdsParam: string;
  readonly VpcPublicSubnetIdsParam: string;
  readonly ChatbotApiUrlParam: string;
  readonly ChatbotLambdaArnParam: string;
  readonly UserPoolIdParam: string;
  readonly UserPoolArnParam: string;
  readonly IdentityPoolIdParam: string;
  readonly UnauthRoleArnParam: string;
  readonly AuthRoleArnParam: string;
  readonly ChatS3BucketNameParam: string;
  readonly ChatDynamoDbTableNameParam: string;
  readonly LambdaExecutionRoleArnParam: string;
  readonly ApiGatewayExecutionRoleArnParam: string;
  readonly LogGroupArnParam: string;

  constructor(
    scope: Construct,
    id: string,
    opts: ArtifactStageOpts,
    props?: cdk.StageProps
  ) {
    super(scope, id, props);

    // Instantiate the ParameterStack to pull in the resources
    const artifactsParameterStore = new ParameterStack(this, "ParameterStack", {
      env: opts.env, 
      tenantId: opts.tenantId,
    })

    // Capture the parameters from the ParameterStack for use in later stages or stacks
    this.VpcIdParam = artifactsParameterStore.vpcIdName;  // These are now the parameter names
    this.SecurityGroupIdParam = artifactsParameterStore.securityGroupIdName;
    this.InternetGatewayIdParam = artifactsParameterStore.internetGatewayIdName;
    this.NatGatewayIdParam = artifactsParameterStore.natGatewayIdName;
    this.ElasticIpParam = artifactsParameterStore.elasticIpName;
    this.VpcPrivateSubnetIdsParam = artifactsParameterStore.vpcPrivateSubnetIdsName;
    this.VpcPublicSubnetIdsParam = artifactsParameterStore.vpcPublicSubnetIdsName;
    this.ChatbotApiUrlParam = artifactsParameterStore.chatbotApiUrlName;
    this.ChatbotLambdaArnParam = artifactsParameterStore.chatbotLambdaArnName;
    this.UserPoolIdParam = artifactsParameterStore.userPoolIdName;
    this.UserPoolArnParam = artifactsParameterStore.userPoolArnName;
    this.IdentityPoolIdParam = artifactsParameterStore.identityPoolIdName;
    this.UnauthRoleArnParam = artifactsParameterStore.unauthRoleArnName;
    this.AuthRoleArnParam = artifactsParameterStore.authRoleArnName;
    this.ChatS3BucketNameParam = artifactsParameterStore.chatS3BucketName;
    this.ChatDynamoDbTableNameParam = artifactsParameterStore.chatDynamoDbTableName;
    this.LambdaExecutionRoleArnParam = artifactsParameterStore.lambdaExecutionRoleArnName;
    this.ApiGatewayExecutionRoleArnParam = artifactsParameterStore.apiGatewayExecutionRoleArnName;
    this.LogGroupArnParam = artifactsParameterStore.logGroupArnName;
  }
}
