import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

const BEDROCK_MODEL_ARN = 'arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0';

export class AsterixStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lettersBucket = new s3.Bucket(this, 'LettersBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          maxAge: 3600,
        },
      ],
    });

    const lettersTable = new dynamodb.Table(this, 'LettersTable', {
      partitionKey: { name: 'letterId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const handlerDir = path.resolve(__dirname, '../../backend/src/handlers');

    const commonEnv = {
      BUCKET_NAME: lettersBucket.bucketName,
      TABLE_NAME: lettersTable.tableName,
    };

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: commonEnv,
      projectRoot: path.resolve(__dirname, '../../backend'),
      depsLockFilePath: path.resolve(__dirname, '../../backend/package-lock.json'),
      bundling: {
        externalModules: [],
      },
    };

    const initiateUploadFn = new lambdaNodejs.NodejsFunction(this, 'InitiateUpload', {
      ...commonLambdaProps,
      entry: path.join(handlerDir, 'initiateUpload.ts'),
    });

    const processLetterFn = new lambdaNodejs.NodejsFunction(this, 'ProcessLetter', {
      ...commonLambdaProps,
      entry: path.join(handlerDir, 'processLetter.ts'),
      timeout: cdk.Duration.seconds(120),
    });

    const getLettersFn = new lambdaNodejs.NodejsFunction(this, 'GetLetters', {
      ...commonLambdaProps,
      entry: path.join(handlerDir, 'getLetters.ts'),
    });

    const getLetterFn = new lambdaNodejs.NodejsFunction(this, 'GetLetter', {
      ...commonLambdaProps,
      entry: path.join(handlerDir, 'getLetter.ts'),
    });

    const deleteLetterFn = new lambdaNodejs.NodejsFunction(this, 'DeleteLetter', {
      ...commonLambdaProps,
      entry: path.join(handlerDir, 'deleteLetter.ts'),
    });

    lettersBucket.grantPut(initiateUploadFn);
    lettersBucket.grantRead(processLetterFn);
    lettersBucket.grantDelete(deleteLetterFn);
    lettersTable.grantWriteData(initiateUploadFn);
    lettersTable.grantReadWriteData(processLetterFn);
    lettersTable.grantReadData(getLettersFn);
    lettersTable.grantReadData(getLetterFn);
    lettersTable.grantReadWriteData(deleteLetterFn);

    processLetterFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        BEDROCK_MODEL_ARN,
        `arn:aws:bedrock:eu-west-2:${this.account}:inference-profile/eu.anthropic.claude-sonnet-4-5-20250929-v1:0`,
      ],
    }));

    processLetterFn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'aws-marketplace:ViewSubscriptions',
        'aws-marketplace:Subscribe',
        'aws-marketplace:Unsubscribe',
      ],
      resources: ['*'],
    }));

    lettersBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(processLetterFn),
    );

    const api = new apigateway.RestApi(this, 'ClinicalLettersApi', {
      restApiName: 'Asterix Clinical Letters API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Api-Key'],
      },
    });

    const letters = api.root.addResource('letters');
    letters.addMethod('POST', new apigateway.LambdaIntegration(initiateUploadFn));
    letters.addMethod('GET', new apigateway.LambdaIntegration(getLettersFn));

    const letter = letters.addResource('{id}');
    letter.addMethod('GET', new apigateway.LambdaIntegration(getLetterFn));
    letter.addMethod('DELETE', new apigateway.LambdaIntegration(deleteLetterFn));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'BucketName', { value: lettersBucket.bucketName });
    new cdk.CfnOutput(this, 'TableName', { value: lettersTable.tableName });
  }
}
