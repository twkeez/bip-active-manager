import { BigQuery } from "@google-cloud/bigquery";
import { getBigQueryConfig } from "@/lib/env";

let cachedBigQuery: BigQuery | null = null;

export function getBigQueryClient() {
  if (cachedBigQuery) return cachedBigQuery;
  const config = getBigQueryConfig();
  cachedBigQuery = new BigQuery({
    projectId: config.projectId,
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
  });
  return cachedBigQuery;
}

export function getBigQueryDatasetRef() {
  const config = getBigQueryConfig();
  return {
    projectId: config.projectId,
    datasetId: config.dataset,
    datasetFqn: `\`${config.projectId}.${config.dataset}\``,
  };
}

export async function runBigQueryQuery<T extends object = Record<string, unknown>>(
  query: string,
  params?: Record<string, unknown>,
) {
  const client = getBigQueryClient();
  const [job] = await client.createQueryJob({
    query,
    params,
    useLegacySql: false,
  });
  const [rows] = await job.getQueryResults();
  return rows as T[];
}

export async function ensureBigQueryDataset() {
  const client = getBigQueryClient();
  const { datasetId } = getBigQueryDatasetRef();
  const dataset = client.dataset(datasetId);
  const [exists] = await dataset.exists();
  if (!exists) {
    throw new Error(`BigQuery dataset does not exist: ${datasetId}`);
  }
  return dataset;
}
