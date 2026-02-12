#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { QuizAppStack } from '../lib/recallr-stack';

const app = new cdk.App();
new QuizAppStack(app, 'QuizAppStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
