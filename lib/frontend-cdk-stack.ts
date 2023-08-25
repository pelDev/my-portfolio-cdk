import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StaticSite } from './static-site';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class FrontendCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new StaticSite(this, "MyPortfolioStaticSite", {
      siteSubDomain: "",
      domainName: "pelumiakinrele.site"
    });
  }
}
