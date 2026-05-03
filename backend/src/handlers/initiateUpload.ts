import { APIGatewayProxyHandler } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { dynamodb, s3 } from '../lib/clients';
import { Letter } from '../lib/types';

const BUCKET_NAME = process.env.BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body ?? '{}');
    const { fileName, fileSize, contentType } = body;

    if (!fileName || !fileSize || !contentType) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'fileName, fileSize, and contentType are required' }),
      };
    }

    if (contentType !== 'application/pdf') {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Only PDF files are accepted' }),
      };
    }

    if (fileSize > MAX_FILE_SIZE) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'File size must not exceed 10MB' }),
      };
    }

    const letterId = uuidv4();
    const s3Key = `letters/${letterId}/${fileName}`;

    const letter: Letter = {
      letterId,
      fileName,
      s3Key,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    };

    await dynamodb.send(new PutCommand({ TableName: TABLE_NAME, Item: letter }));

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: contentType,
        ContentLength: fileSize,
      }),
      { expiresIn: 300 }
    );

    console.log(JSON.stringify({ event: 'upload_initiated', letterId, fileName }));

    return {
      statusCode: 201,
      headers: corsHeaders(),
      body: JSON.stringify({ letterId, uploadUrl }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'initiate_upload_error', error: String(err) }));
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
