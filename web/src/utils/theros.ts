import { TheroConfig } from '../types';

/**
 * Dynamically resolves S3 base URL from environment variables for a given thero.
 * Safe to import on the client.
 */
export function getTheroS3BaseUrl(config: TheroConfig): string {
  if (config.rss) {
    // Extract base S3 directory from the RSS feed absolute URL
    return config.rss.substring(0, config.rss.lastIndexOf('/'));
  }

  const endpointEnv = config.s3.endpoint_env;
  const bucketEnv = config.s3.bucket_env;

  const endpoint = process.env[endpointEnv] || 'https://s3.amazonaws.com';
  const bucket = process.env[bucketEnv] || '';

  // Clean the endpoint trailing slash
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  
  return `${cleanEndpoint}/${bucket}`;
}
