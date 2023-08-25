import { Aws, CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";

export interface StaticSiteProps {
  domainName: string;
  siteSubDomain: string;
}

export class StaticSite extends Construct {
  constructor(
    parent: Stack,
    name: string,
    props: StaticSiteProps
  ) {
    super(parent, name);

    const siteDomain = props.siteSubDomain ? props.siteSubDomain + "." + props.domainName : props.domainName;

    const siteBucket = new s3.Bucket(this, `SiteBucket-${name}`, {
      bucketName: siteDomain,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
      autoDeleteObjects: true, // NOT recommended for production code
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
    });

    // TLS CERTIFICATE
    const certificate = new acm.Certificate(this, `ml-cert-${name}`, {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(),
    });

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(
      this,
      `cloudfront-static-site-OAI-${name}`,
      {
        comment: `OAI for ${name}`,
      }
    );

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [
          new iam.CanonicalUserPrincipal(
            cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    const viewerCert = cloudfront.ViewerCertificate.fromAcmCertificate(
      {
        certificateArn: certificate.certificateArn,
        env: {
          region: Aws.REGION,
          account: Aws.ACCOUNT_ID,
        },
        node: parent.node,
        stack: parent,
        metricDaysToExpiry: () =>
          new Metric({
            namespace: "TLS viewer certificate validity",
            metricName: "TLS Viewer Certificate expired",
          }),
        applyRemovalPolicy: (policy) => {},
      },
      {
        sslMethod: cloudfront.SSLMethod.SNI,
        securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_1_2016,
        aliases: [siteDomain],
      }
    );

    const cloudfrontDistribution = new cloudfront.CloudFrontWebDistribution(
      this,
      `CloudFrontDistribution-${name}`,
      {
        viewerCertificate: viewerCert,
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: siteBucket,
              originAccessIdentity: cloudfrontOAI,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                compress: true,
                allowedMethods:
                  cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              },
            ],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 403,
            errorCachingMinTtl: 1,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    new s3deploy.BucketDeployment(this, "DeployWebsite-" + name, {
      sources: [s3deploy.Source.asset("website")],
      destinationBucket: siteBucket,
      distribution: cloudfrontDistribution,
    });

    new CfnOutput(this, "Bucket", { value: siteBucket.bucketName });
    new CfnOutput(this, "Certificate", { value: certificate.certificateArn });

    new CfnOutput(this, "distributionDomainName", {
      value: cloudfrontDistribution.distributionDomainName,
    });
  }
}
