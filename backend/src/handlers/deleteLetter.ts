import { APIGatewayProxyHandler } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { dynamodb, s3 } from '../lib/clients';

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const letterId = event.pathParameters?.id;

    if (!letterId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Missing letter ID' }),
      };
    }

    const userId = event.requestContext.authorizer?.claims?.sub as string;

    const result = await dynamodb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { letterId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Letter not found' }),
      };
    }

    if (result.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    await dynamodb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { letterId },
    }));

    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: result.Item.s3Key,
    }));

    console.log(JSON.stringify({ event: 'letter_deleted', letterId }));

    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'delete_letter_error', error: String(err) }));
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
  };
}
