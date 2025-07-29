import { Injectable, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ConfigService } from "@nestjs/config";

@Injectable()
export class FileUploadService {
    private readonly s3Client: S3Client;
    private readonly logger = new Logger(FileUploadService.name);
    private readonly bucketName: string;

    constructor(
        private readonly configService: ConfigService
    ) {
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        const region = this.configService.get<string>('AWS_REGION');
        this.bucketName = this.configService.getOrThrow<string>('AWS_S3_BUCKET');

        if (!accessKeyId || !secretAccessKey || !region || !this.bucketName) {
            throw new Error('Missing required AWS environment variables');
        }

        this.s3Client = new S3Client({
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            region,
        });
    }

    async uploadToS3(
        buffer: Buffer,
        key: string,
        contentType: string = 'application/octet-stream'
    ): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                ServerSideEncryption: 'AES256',
            });

            await this.s3Client.send(command);

            const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

            this.logger.log(`File uploaded successfully to S3: ${key}`);
            return url;
        } catch (error) {
            this.logger.error(`Error uploading file to S3: ${error.message}`, error.stack);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    async downloadFromS3(key: string): Promise<Buffer> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const result = await this.s3Client.send(command);

            if (!result.Body) {
                throw new Error('File not found or empty');
            }

            const buffer = await this.streamToBuffer(result.Body as Readable);

            this.logger.log(`File downloaded successfully from S3: ${key}`);
            return buffer;
        } catch (error) {
            this.logger.error(`Error downloading file from S3: ${error.message}`, error.stack);
            throw new Error(`Failed to download file from S3: ${error.message}`);
        }
    }

    async deleteFromS3(key: string): Promise<void> {
        try {
            const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            this.logger.log(`File deleted successfully from S3: ${key}`);
        } catch (error) {
            this.logger.error(`Error deleting file from S3: ${error.message}`, error.stack);
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }

    async fileExists(key: string): Promise<boolean> {
        try {
            const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            throw error;
        }
    }

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }
}