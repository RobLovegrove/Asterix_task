# Architecture Diagram

## System Components

```mermaid
flowchart TD
    Browser["Browser"]

    CF["CloudFront + S3<br/>(Frontend Hosting)"]
    Cognito["AWS Cognito<br/>(Authentication)"]
    APIGW["API Gateway<br/>(Cognito Authoriser)"]

    L1["Lambda: initiateUpload"]
    L2["Lambda: processLetter"]
    L3["Lambda: getLetters / getLetter"]
    L4["Lambda: deleteLetter"]

    S3["S3<br/>(PDF Storage)"]
    DB["DynamoDB<br/>(Letter Records)"]
    Bedrock["Amazon Bedrock<br/>(Claude Sonnet 4.5)"]

    Browser --> CF
    Browser --> Cognito
    Browser --> APIGW

    APIGW --> L1
    APIGW --> L3
    APIGW --> L4

    L1 --> DB
    L1 -->|pre-signed URL| S3
    S3 -->|ObjectCreated event| L2
    L2 --> Bedrock
    L2 --> DB
    L3 --> DB
    L4 --> DB
    L4 --> S3
```

## Upload & Processing Flow

```mermaid
flowchart LR
    A([User uploads PDF]) --> B[POST /letters]
    B --> C[Lambda creates\nDynamoDB record\nstatus: pending]
    C --> D[Returns pre-signed\nS3 URL]
    D --> E[Browser uploads\ndirectly to S3]
    E --> F[S3 event triggers\nprocessLetter Lambda]
    F --> G[Extract text\n+ NHS number]
    G --> H[Call Bedrock\nfor summary]
    H --> I[Update DynamoDB\nstatus: completed]
    I --> J([Frontend polls\nand displays result])
```
