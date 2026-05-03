import { S3Handler } from 'aws-lambda';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { extractText } from 'unpdf';
import { dynamodb, s3 } from '../lib/clients';

const TABLE_NAME = process.env.TABLE_NAME!;
const bedrock = new AnthropicBedrock({ awsRegion: 'eu-west-2' });

// NHS numbers are 10 digits, sometimes formatted with spaces
const NHS_NUMBER_REGEX = /\b(\d{3}[ -]?\d{3}[ -]?\d{4})\b/;

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const letterId = s3Key.split('/')[1];

    console.log(JSON.stringify({ event: 'process_letter_start', letterId, s3Key }));

    try {
      await markProcessing(letterId);

      const pdfBuffer = await downloadFromS3(bucketName, s3Key);
      const { text } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true });

      const nhsNumber = extractNhsNumber(text);
      const summary = await summariseLetter(text);

      await markCompleted(letterId, nhsNumber, summary);

      console.log(JSON.stringify({ event: 'process_letter_complete', letterId }));
    } catch (err) {
      console.error(JSON.stringify({ event: 'process_letter_error', letterId, error: String(err) }));
      await markFailed(letterId, String(err));
    }
  }
};

async function downloadFromS3(bucket: string, key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function extractNhsNumber(text: string): string | undefined {
  const match = NHS_NUMBER_REGEX.exec(text);
  return match?.[1]?.replace(/[ -]/g, '');
}

async function summariseLetter(text: string): Promise<string> {
  const message = await bedrock.messages.create({
    model: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a clinical assistant helping doctors quickly understand patient letters.

Summarise the following clinical letter in 3-5 bullet points. Do not include a heading or introductory label. Focus on:
- The primary reason for the letter
- Key clinical findings or diagnoses
- Medications or treatments mentioned
- Any follow-up actions required

Clinical letter:
${text}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected LLM response type');
  return content.text;
}

async function markProcessing(letterId: string): Promise<void> {
  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { letterId },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'processing' },
  }));
}

async function markCompleted(letterId: string, nhsNumber: string | undefined, summary: string): Promise<void> {
  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { letterId },
    UpdateExpression: 'SET #status = :status, nhsNumber = :nhsNumber, summary = :summary, processedAt = :processedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':nhsNumber': nhsNumber ?? null,
      ':summary': summary,
      ':processedAt': new Date().toISOString(),
    },
  }));
}

async function markFailed(letterId: string, errorMessage: string): Promise<void> {
  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { letterId },
    UpdateExpression: 'SET #status = :status, errorMessage = :errorMessage',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'failed',
      ':errorMessage': errorMessage,
    },
  }));
}
