// SSM Parameter Store loader for the bot. Same shape as the API's loader
// in apps/api/src/lib/secrets.ts — kept in sync by hand. Pulls every
// parameter under /boneless/prod/* into process.env at startup so the rest
// of the bot reads secrets through the same surface as in dev.
//
// Activation gate: NODE_ENV=production AND SECRETS_SOURCE=ssm

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
      if (process.env[key] === undefined) {
        process.env[key] = p.Value;
        count++;
      }
    }
    nextToken = out.NextToken;
  } while (nextToken);

  console.log(`[secrets] loaded ${count} params from SSM (${region})`);
}
