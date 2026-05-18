// SSM Parameter Store loader. Pulls every parameter under /boneless/prod/*
// at startup and populates process.env so the rest of the app reads secrets
// the same way it does in development (via dotenv).
//
// Activation gate:
//   NODE_ENV=production  AND  SECRETS_SOURCE=ssm
//
// Both must be set so a stray NODE_ENV=production locally doesn't try to
// reach AWS without an opt-in. Default behavior stays: read from .env via
// dotenv (config.ts handles that).
//
// IAM requirements on the runtime (EC2 Instance Role):
//   ssm:GetParametersByPath  on  arn:aws:ssm:<region>:<account>:parameter/boneless/prod/*
//   kms:Decrypt              on  the SSM-managed KMS key (alias/aws/ssm)
//
// CloudTrail logs every GetParametersByPath call so reads are auditable.

import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const PATH_PREFIX = "/boneless/prod/";

export async function loadSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== "production" || process.env.SECRETS_SOURCE !== "ssm") {
    return;
  }

  const region = process.env.AWS_REGION ?? "us-east-1";
  const client = new SSMClient({ region });

  let nextToken: string | undefined;
  let count = 0;
  do {
    const out = await client.send(
      new GetParametersByPathCommand({
        Path: PATH_PREFIX,
        Recursive: false,
        WithDecryption: true,
        NextToken: nextToken,
      })
    );
    for (const p of out.Parameters ?? []) {
      if (!p.Name || p.Value === undefined) continue;
      const key = p.Name.slice(PATH_PREFIX.length);
      // Don't clobber values already set in the environment — lets you
      // override one secret at deploy time without re-uploading to SSM
      // (e.g. emergency rotation, A/B testing).
      if (process.env[key] === undefined) {
        process.env[key] = p.Value;
        count++;
      }
    }
    nextToken = out.NextToken;
  } while (nextToken);

  console.log(`[secrets] loaded ${count} params from SSM (${region})`);
}
