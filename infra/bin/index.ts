#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GetTrainMateStack } from '../stacks/main-stack';

const app = new cdk.App();

new GetTrainMateStack(app, 'GetTrainMateStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'GetTrainMate - Training partner matching platform infrastructure',
});
