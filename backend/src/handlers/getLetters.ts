import { APIGatewayProxyHandler } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../lib/clients';

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const result = await dynamodb.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'letterId, fileName, nhsNumber, #status, uploadedAt, processedAt',
      ExpressionAttributeNames: { '#status': 'status' },
    }));

    const letters = (result.Items ?? []).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(letters),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'get_letters_error', error: String(err) }));
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
