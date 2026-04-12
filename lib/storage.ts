import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.STORAGE_ENDPOINT ?? 'https://t3.storage.dev',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const getBucket = () => process.env.STORAGE_BUCKET_NAME ?? ''

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  const client = getClient()
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }))
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(client, command, { expiresIn })
}
