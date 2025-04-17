import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, SubnetType, SecurityGroup, Peer, Port, CfnEIP, CfnNatGateway, CfnInternetGateway } from 'aws-cdk-lib/aws-ec2';

export class VPCStack extends cdk.Stack {
  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;
  readonly internetGateway: CfnInternetGateway;
  readonly natGateway: CfnNatGateway;
  readonly elasticIp: CfnEIP;
  readonly privateSubnetIds: string[];
  readonly publicSubnetIds: string[];

  constructor(scope: Construct, id: string, opts: { tenantId: string, env: string }, props?: cdk.StackProps) {
    super(scope, id, props);

    const { tenantId, env } = opts;  // Destructure tenantId and env from opts

    // Create the VPC
    this.vpc = new Vpc(this, `${tenantId}-vpc-${env}`, {
      maxAzs: 2, // Max 2 Availability Zones for high availability
      natGateways: 1, // 1 NAT Gateway for private subnets to access the internet
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,  // Public subnet
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,  // Private subnet with NAT Gateway
        },
      ],
    });

    // Create Internet Gateway (for public subnets to access the internet)
    this.internetGateway = new cdk.aws_ec2.CfnInternetGateway(this, `${tenantId}-internet-gateway-${env}`, {
      tags: [
        { key: 'Name', value: `${tenantId}-internet-gateway-${env}` }
      ],
    });
    new cdk.aws_ec2.CfnVPCGatewayAttachment(this, `${tenantId}-vpc-gateway-attachment-${env}`, {
      vpcId: this.vpc.vpcId,
      internetGatewayId: this.internetGateway.ref,
    });

    // Create NAT Gateway (for private subnets to access the internet)
    this.elasticIp = new CfnEIP(this, `${tenantId}-elastic-ip-${env}`, {
      domain: 'vpc',  // EIP for the NAT Gateway
    });

    this.natGateway = new CfnNatGateway(this, `${tenantId}-nat-gateway-${env}`, {
      allocationId: this.elasticIp.attrAllocationId,
      subnetId: this.vpc.publicSubnets[0].subnetId,
      tags: [
        { key: 'Name', value: `${tenantId}-nat-gateway-${env}` }
      ],
    });

    // Security Group for Lambda functions or API Gateway (optional)
    this.securityGroup = new SecurityGroup(this, `${tenantId}-security-group-${env}`, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group for Lambda functions or API Gateway',
    });

    // Allow inbound HTTP (port 80) and HTTPS (port 443) traffic for public services
    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP access');
    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS access');

    // Outputs for use in other stacks
    new cdk.CfnOutput(this, `${tenantId}-VpcId-${env}`, {
      value: this.vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${tenantId}-VpcId-${env}`,  // Export the VPC ID to be used in other stacks
    });

    new cdk.CfnOutput(this, `${tenantId}-SecurityGroupId-${env}`, {
      value: this.securityGroup.securityGroupId,
      description: 'The ID of the Security Group',
      exportName: `${tenantId}-SecurityGroupId-${env}`,  // Export the security group ID
    });

    new cdk.CfnOutput(this, `${tenantId}-InternetGatewayId-${env}`, {
      value: this.internetGateway.ref,
      description: 'The ID of the Internet Gateway',
      exportName: `${tenantId}-InternetGatewayId-${env}`,  // Export the internet gateway ID
    });

    new cdk.CfnOutput(this, `${tenantId}-NatGatewayId-${env}`, {
      value: this.natGateway.ref,
      description: 'The ID of the NAT Gateway',
      exportName: `${tenantId}-NatGatewayId-${env}`,  // Export the NAT Gateway ID
    });

    new cdk.CfnOutput(this, `${tenantId}-ElasticIp-${env}`, {
      value: this.elasticIp.ref,
      description: 'The Elastic IP for the NAT Gateway',
      exportName: `${tenantId}-ElasticIp-${env}`,  // Export the Elastic IP
    });

    new cdk.CfnOutput(this, `${tenantId}-VpcPrivateSubnetIds-${env}`, {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'The IDs of the private subnets',
      exportName: `${tenantId}-VpcPrivateSubnetIds-${env}`,  // Export private subnet IDs for use in other stacks
    });

    new cdk.CfnOutput(this, `${tenantId}-VpcPublicSubnetIds-${env}`, {
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'The IDs of the public subnets',
      exportName: `${tenantId}-VpcPublicSubnetIds-${env}`,  // Export public subnet IDs for use in other stacks
    });
  }
}
