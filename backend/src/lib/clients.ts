import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION ?? 'eu-west-2';

export const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
export const s3 = new S3Client({ region });
