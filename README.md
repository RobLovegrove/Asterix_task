# Clinical Letters — Asterix Tech Test

A serverless application that processes NHS clinical letters, extracts relevant data, generates AI-powered summaries, and stores them securely. Built with AWS CDK, Lambda, DynamoDB, S3, and React.

---

## Architecture Overview

The system uses an asynchronous processing architecture:

1. The user authenticates via Cognito and uploads a PDF through the React frontend
2. The frontend calls `POST /letters` to receive a pre-signed S3 URL
3. The PDF is uploaded directly from the browser to S3 — it never passes through Lambda
4. S3 fires an event notification that triggers the processing Lambda
5. The processing Lambda extracts text from the PDF, identifies the NHS number, and calls Amazon Bedrock (Claude Sonnet 4.5) to generate a summary
6. Results are stored in DynamoDB and the frontend polls until processing is complete

```
Browser → API Gateway → Lambda (initiateUpload) → DynamoDB (pending) → S3 pre-signed URL
Browser → S3 (direct upload)
S3 event → Lambda (processLetter) → Bedrock (Claude) → DynamoDB (completed)
Browser → API Gateway → Lambda (getLetters/getLetter) → DynamoDB
```

See `architecture.png` for the UML sequence diagram.

---

## Tech Stack & Justification

| Layer | Choice | Justification |
|---|---|---|
| IaC | AWS CDK (TypeScript) | Native AWS tooling; infrastructure defined in the same language as application code |
| API | API Gateway + Lambda | Serverless-native; scales to zero; no infrastructure to manage |
| Storage | S3 | Industry standard for object storage; pre-signed URLs allow direct browser uploads without routing through Lambda |
| Database | DynamoDB | Serverless-native; no connection pooling issues with Lambda; access patterns (get by user, get by ID) fit perfectly; scales automatically |
| LLM | Amazon Bedrock (Claude Sonnet 4.5) | Data never leaves AWS infrastructure — critical for NHS data sovereignty; IAM-based access removes the need to manage API keys |
| Auth | AWS Cognito | Managed user authentication with JWT tokens; integrates natively with API Gateway authorisers |
| Frontend | React + Vite | Fast build tooling; straightforward component model for the required UI |
| Language | TypeScript throughout | Type safety across backend and frontend; shared types where possible |

---

## Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials (`aws configure`)
- AWS CDK installed (`npm install -g aws-cdk`)

### Local Development

```bash
# Backend
cd backend
npm install

# Run tests
npm test

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

The frontend requires a `.env` file:

```
VITE_API_URL=https://<api-gateway-id>.execute-api.eu-west-2.amazonaws.com/prod
VITE_USER_POOL_ID=eu-west-2_<pool-id>
VITE_USER_POOL_CLIENT_ID=<client-id>
```

These values are output by `cdk deploy`.

---

## Deployment

```bash
# 1. Bootstrap CDK (first time only)
cd infrastructure
npm install
npx cdk bootstrap

# 2. Build the frontend
cd ../frontend
npm install
npm run build

# 3. Deploy everything
cd ../infrastructure
npx cdk deploy
```

The deploy outputs the frontend URL, API URL, Cognito User Pool ID, and Client ID.

To redeploy after frontend changes:

```bash
cd frontend && npm run build && cd ../infrastructure && npx cdk deploy
```

---

## Technical Decisions

### 1. Security

**What we've implemented:**
- **Authentication**: AWS Cognito with JWT tokens. All API endpoints require a valid token via API Gateway's Cognito authoriser. Users can only access their own letters — the `userId` from the JWT is stored with each letter and verified on every request.
- **File uploads**: Pre-signed S3 URLs with a 5-minute expiry. The PDF goes directly from the browser to S3 — it never passes through Lambda, reducing attack surface and avoiding Lambda memory limits.
- **Data at rest**: S3 bucket uses S3-managed encryption (SSE-S3). DynamoDB encrypts at rest by default. The bucket blocks all public access.
- **LLM data sovereignty**: Amazon Bedrock is used rather than the Anthropic API directly, so clinical letter content never leaves the AWS `eu-west-2` (London) region.
- **IAM least privilege**: Each Lambda function has its own IAM role with only the permissions it needs.

**With more time:**
- HTTPS-only enforcement via CloudFront (in place for the frontend; would extend to API Gateway)
- S3 lifecycle policies to automatically delete PDFs after a retention period, in line with NHS data minimisation requirements
- VPC placement for Lambda functions to restrict network egress
- AWS WAF on API Gateway to protect against common web exploits
- CloudTrail audit logging for all data access

### 2. Scalability

The current architecture scales automatically without code changes:

- **Lambda** scales horizontally per request with no configuration required
- **DynamoDB** is provisioned with `PAY_PER_REQUEST` billing, which scales reads and writes on demand
- **S3** has no practical throughput limit for object storage
- **API Gateway** handles up to 10,000 requests per second by default

**At 10x traffic:** The current design handles this comfortably. The DynamoDB GSI on `userId` means letter queries scale with the user, not with table size.

**At 100x traffic:**
- The `getLetters` query uses a GSI scan per user — this remains efficient as long as users don't have thousands of letters
- Lambda cold starts could become noticeable; Provisioned Concurrency would address this for latency-sensitive paths
- Bedrock has its own throughput limits; we would need to request a quota increase or implement request queuing with SQS

**What breaks first:** Bedrock throughput quotas. At high volume, the processing Lambda would need to queue requests rather than call Bedrock synchronously.

### 3. Error Handling

| Scenario | How it's handled |
|---|---|
| Failed LLM call | The processing Lambda catches the error, marks the letter as `failed` in DynamoDB with the error message stored, and logs the full error to CloudWatch |
| Corrupted PDF | `unpdf` throws during text extraction; caught and marked as `failed` |
| Concurrent uploads of the same file | Each upload generates a UUID `letterId` and unique S3 key, so concurrent uploads of the same file create independent records with no conflict |
| DynamoDB failure | Lambda catches and logs the error; for the processing Lambda the letter remains in `processing` state and can be retried by re-uploading |
| Expired pre-signed URL | The browser receives a 403 from S3; the upload form surfaces this as a user-facing error |

### 4. Observability

**Current implementation:**
- All Lambda functions emit structured JSON logs to CloudWatch Logs automatically:
  ```json
  { "event": "process_letter_complete", "letterId": "abc-123" }
  { "event": "process_letter_error", "letterId": "abc-123", "error": "..." }
  ```
- Logs are queryable via CloudWatch Log Insights

**To debug a production issue:**
1. Filter CloudWatch logs by `letterId` to trace a specific letter through the system
2. Check the `status` and `errorMessage` fields in DynamoDB for the affected record
3. Correlate timestamps across the `initiateUpload` and `processLetter` log groups

**With more time:**
- CloudWatch Alarms on Lambda error rates and duration (alert when processing takes >60 seconds)
- AWS X-Ray for distributed tracing across Lambda, DynamoDB, S3, and Bedrock
- Custom CloudWatch metrics: processing duration, LLM latency, upload success rate, error rate by type
- A dashboard surfacing the above metrics

### 5. Cost

**Main cost drivers:**
| Service | Billing model |
|---|---|
| Lambda | Per invocation + per GB-second of compute |
| API Gateway | Per API call |
| DynamoDB | Per read/write request unit |
| S3 | Per GB stored + per request |
| Bedrock (Claude) | Per input/output token |
| CloudFront | Per GB transferred |

At low volume (hundreds of letters per month), this architecture costs pennies. Bedrock token costs are the most variable — a typical clinical letter summary costs approximately $0.001–0.005 depending on letter length.

**Optimisation opportunities:**
- Add S3 lifecycle rules to move PDFs to Glacier after 90 days and delete after a retention period
- Use DynamoDB's on-demand pricing (already in place) rather than provisioned capacity
- Cache Bedrock responses for identical documents (though unlikely to be useful for unique clinical letters)

### 6. Data Model

**Why DynamoDB:**
- The access patterns are simple and well-defined: fetch by user, fetch by ID
- Lambda functions have no persistent connections — DynamoDB's HTTP-based API avoids the connection pooling issues that affect RDS in serverless environments
- No joins are required; each letter is a self-contained document

**Schema:**

| Attribute | Type | Notes |
|---|---|---|
| `letterId` | String (PK) | UUID, partition key |
| `userId` | String | Cognito user sub; GSI partition key |
| `uploadedAt` | String | ISO timestamp; GSI sort key |
| `status` | String | `pending` / `processing` / `completed` / `failed` |
| `fileName` | String | Original filename |
| `s3Key` | String | Full S3 object path |
| `nhsNumber` | String | Extracted 10-digit number |
| `summary` | String | Markdown-formatted LLM summary |
| `errorMessage` | String | Populated if status is `failed` |
| `processedAt` | String | ISO timestamp of completion |

A Global Secondary Index (`userId-index`) on `userId` + `uploadedAt` allows efficient per-user listing without scanning the full table.

### 7. Async vs Sync Processing

**Decision: asynchronous via S3 event notifications.**

API Gateway enforces a hard 29-second timeout on all requests. PDF text extraction and an LLM call can together take 10–30 seconds, making synchronous processing unreliable.

The async flow works as follows: `POST /letters` returns immediately with a `letterId` and a pre-signed upload URL. The browser uploads the PDF directly to S3. An S3 event triggers the processing Lambda independently of any HTTP connection. The frontend polls `GET /letters/{id}` every 3 seconds until the status changes to `completed` or `failed`.

This approach also means the file upload itself never passes through Lambda, avoiding Lambda's 6MB payload limit for synchronous invocations.

---

## Known Limitations & Future Improvements

- **No S3 lifecycle policies**: PDFs are stored indefinitely. In production, a lifecycle policy would enforce a retention period in line with NHS data governance requirements.
- **NHS number validation**: We extract 10-digit numbers matching the NHS format but do not apply the Modulus 11 check digit algorithm. This could produce false positives.
- **No CI/CD pipeline**: Deployment is manual. In production, a GitHub Actions workflow would run tests, build, and deploy on merge to main.
- **Single-region**: The stack deploys to `eu-west-2` only. For high availability, a multi-region active-passive setup with Route 53 failover would be appropriate.
- **Cognito email verification**: Requires a valid email address. In a production NHS context, this would be replaced with NHS login (NHS OAuth) or an organisation-managed identity provider.
- **Test coverage**: One unit test suite covers NHS number extraction. In production, integration tests covering the upload → processing → retrieval flow would be added.
- **No PDF download**: Users can view summaries but cannot download the original PDF from the UI. A pre-signed `GET` URL endpoint would enable this.

---

## Assumptions

- Users are authenticated clinicians within a single organisation; there is no role-based access control between users
- PDFs are well-formed and machine-readable (not scanned images); OCR is not implemented
- The NHS number appears in plain text within the letter body
- `eu-west-2` (London) satisfies data residency requirements for this prototype
