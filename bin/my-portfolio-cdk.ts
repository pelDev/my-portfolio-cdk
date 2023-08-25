#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FrontendCdkStack } from '../lib/frontend-cdk-stack';

const app = new cdk.App();
new FrontendCdkStack(app, 'FrontendCdkStack', {
  env: { account: '604778390690', region: 'us-east-1' },
});