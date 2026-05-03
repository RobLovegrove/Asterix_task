import * as cdk from 'aws-cdk-lib';
import { AsterixStack } from '../lib/asterix-stack';

const app = new cdk.App();
new AsterixStack(app, 'AsterixStack', {
  env: { region: 'eu-west-2' },
});
