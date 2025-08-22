import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../utils/logger";

const S3_BUCKET_NAME = `tracking-software-bucket-${["dev", "development"].includes(process.env.NODE_ENV || "") ? "sandbox" : "production"}`; // theres no aws dev env yet

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "eu-central-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    this.bucketName = S3_BUCKET_NAME;
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType?: string
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key.startsWith("/") ? key.substring(1) : key, // Remove leading slash
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      });

      await this.s3Client.send(command);
      logger.info(`Successfully uploaded file to S3: ${key}`);

      return key;
    } catch (error) {
      logger.error("Failed to upload file to S3:", error);
      throw new Error(`S3 upload failed: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key.startsWith("/") ? key.substring(1) : key,
      });

      await this.s3Client.send(command);
      logger.info(`Successfully deleted file from S3: ${key}`);
    } catch (error) {
      logger.error("Failed to delete file from S3:", error);
      throw new Error(`S3 delete failed: ${error}`);
    }
  }

  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key.startsWith("/") ? key.substring(1) : key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      logger.info(`Generated presigned URL for S3 object: ${key}`);

      return signedUrl;
    } catch (error) {
      logger.error("Failed to generate presigned URL:", error);
      throw new Error(`S3 presigned URL generation failed: ${error}`);
    }
  }

  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key.startsWith("/") ? key.substring(1) : key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      logger.info(`Generated presigned upload URL for S3 object: ${key}`);

      return signedUrl;
    } catch (error) {
      logger.error("Failed to generate presigned upload URL:", error);
      throw new Error(`S3 presigned upload URL generation failed: ${error}`);
    }
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.startsWith("/") ? key.substring(1) : key;
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${cleanKey}`;
  }
}

export const s3Service = new S3Service();
