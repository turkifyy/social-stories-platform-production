import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { firestoreService } from './firestore';

interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
}

interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

interface ListObjectsResult {
  objects: Array<{
    key: string;
    size: number;
    lastModified?: Date;
  }>;
  hasMore: boolean;
  nextToken?: string;
}

export class R2StorageService {
  private client: S3Client | null = null;
  private bucketName: string = '';
  private accountId: string = '';

  async initialize() {
    const config = await firestoreService.getAPIConfig('cloudflare_r2');
    const r2Config: R2Config = {
      accountId: config?.additionalConfig?.accountId || process.env.R2_ACCOUNT_ID,
      accessKeyId: config?.additionalConfig?.accessKeyId || process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: config?.additionalConfig?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY,
      bucketName: config?.additionalConfig?.bucketName || process.env.R2_BUCKET_NAME,
    };

    if (!r2Config.accountId || !r2Config.accessKeyId || !r2Config.secretAccessKey || !r2Config.bucketName) {
      throw new Error('Missing Cloudflare R2 configuration. Please configure R2 credentials in the admin panel or environment variables.');
    }

    this.accountId = r2Config.accountId;
    this.bucketName = r2Config.bucketName;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }

  private async ensureInitialized() {
    if (!this.client) {
      await this.initialize();
    }
  }

  private sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const hasNonAscii = /[^\x00-\x7F]/.test(value);
      if (hasNonAscii) {
        sanitized[key] = Buffer.from(value, 'utf-8').toString('base64');
        sanitized[`${key}-encoded`] = 'base64';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async uploadFile(file: Buffer, fileName: string, options?: UploadOptions): Promise<string> {
    await this.ensureInitialized();

    const sanitizedMetadata = this.sanitizeMetadata(options?.metadata);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file,
      ContentType: options?.contentType || 'application/octet-stream',
      Metadata: sanitizedMetadata,
      CacheControl: options?.cacheControl || 'public, max-age=31536000, immutable',
    });

    // Start upload and return immediately to speed up the process flow
    this.client!.send(command).catch(err => console.error(`Background upload failed for ${fileName}:`, err));

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    const presignedUrl = await getSignedUrl(this.client!, getCommand, { expiresIn: 604800 });
    return presignedUrl;
  }

  async uploadFileWithLongUrl(file: Buffer, fileName: string, options?: UploadOptions): Promise<string> {
    await this.ensureInitialized();

    const sanitizedMetadata = this.sanitizeMetadata(options?.metadata);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file,
      ContentType: options?.contentType || 'application/octet-stream',
      Metadata: sanitizedMetadata,
      CacheControl: options?.cacheControl || 'public, max-age=31536000',
    });

    await this.client!.send(command);

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    // AWS S3 Signature V4 max expiration is 7 days (604800 seconds)
    const presignedUrl = await getSignedUrl(this.client!, getCommand, { expiresIn: 604800 });
    return presignedUrl;
  }

  async getFile(fileName: string): Promise<Buffer> {
    await this.ensureInitialized();

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    const response = await this.client!.send(command);
    
    if (!response.Body) {
      throw new Error('File not found or empty');
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  async getFileUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    await this.ensureInitialized();

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    const url = await getSignedUrl(this.client!, command, { expiresIn });
    return url;
  }

  async getUploadUrl(fileName: string, contentType?: string, expiresIn: number = 3600): Promise<string> {
    await this.ensureInitialized();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client!, command, { expiresIn });
    return url;
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.ensureInitialized();

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    await this.client!.send(command);
  }

  async listFiles(prefix?: string, maxKeys: number = 1000, continuationToken?: string): Promise<ListObjectsResult> {
    await this.ensureInitialized();

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await this.client!.send(command);

    return {
      objects: (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified,
      })),
      hasMore: response.IsTruncated || false,
      nextToken: response.NextContinuationToken,
    };
  }

  async fileExists(fileName: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.client!.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(fileName: string) {
    await this.ensureInitialized();

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
    });

    const response = await this.client!.send(command);

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
      etag: response.ETag,
    };
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    await this.ensureInitialized();

    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey,
    });

    await this.client!.send(command);
  }

  async uploadFromUrl(url: string, fileName: string, options?: UploadOptions): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await this.uploadFile(buffer, fileName, {
      ...options,
      contentType: options?.contentType || response.headers.get('content-type') || 'application/octet-stream',
    });
  }

  async batchDelete(fileNames: string[]): Promise<void> {
    await this.ensureInitialized();

    const deletePromises = fileNames.map(fileName => this.deleteFile(fileName));
    await Promise.all(deletePromises);
  }

  async getPublicUrl(fileName: string): Promise<string> {
    await this.ensureInitialized();
    return `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucketName}/${fileName}`;
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    await this.ensureInitialized();
    await this.copyFile(sourceKey, destinationKey);
    await this.deleteFile(sourceKey);
  }

  extractFileKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      
      if (url.includes('.r2.cloudflarestorage.com')) {
        if (pathParts.length >= 1 && pathParts[0] === this.bucketName) {
          return pathParts.slice(1).join('/');
        }
        if (pathParts.length >= 1) {
          return pathParts.join('/');
        }
      } else if (url.includes('r2.dev')) {
        if (pathParts.length >= 1) {
          return pathParts.join('/');
        }
      }
      
      if (pathParts.length >= 1) {
        return pathParts.join('/');
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // AWS S3 Signature V4 max expiration is 7 days (604800 seconds)
  async refreshSignedUrl(oldUrl: string, expiresIn: number = 604800): Promise<string> {
    await this.ensureInitialized();
    
    console.log(`🔍 Refreshing URL: ${oldUrl.substring(0, 100)}...`);
    
    const fileKey = this.extractFileKeyFromUrl(oldUrl);
    if (!fileKey) {
      console.log(`❌ Could not extract file key from URL`);
      console.log(`   URL: ${oldUrl}`);
      throw new Error(`تعذر استخراج مفتاح الملف من الرابط: ${oldUrl}`);
    }

    console.log(`📂 Extracted file key: ${fileKey}`);

    try {
      const exists = await this.fileExists(fileKey);
      if (!exists) {
        console.log(`❌ File ${fileKey} does not exist in R2`);
        throw new Error(`الملف ${fileKey} غير موجود في التخزين السحابي. يرجى إعادة توليد الصورة.`);
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const freshUrl = await getSignedUrl(this.client!, command, { expiresIn });
      console.log(`✅ Refreshed signed URL`);
      console.log(`   New URL: ${freshUrl.substring(0, 100)}...`);
      return freshUrl;
    } catch (error: any) {
      console.error(`❌ Error refreshing signed URL:`, error);
      throw new Error(error.message || `فشل في تحديث رابط الملف: ${fileKey}`);
    }
  }

  async getFileAsBuffer(fileName: string): Promise<Buffer> {
    await this.ensureInitialized();

    const exists = await this.fileExists(fileName);
    if (!exists) {
      throw new Error(`الملف ${fileName} غير موجود في التخزين السحابي`);
    }

    return await this.getFile(fileName);
  }

  async verifyAndGetUrl(url: string): Promise<{ valid: boolean; freshUrl?: string; fileKey?: string; error?: string }> {
    await this.ensureInitialized();
    
    const fileKey = this.extractFileKeyFromUrl(url);
    if (!fileKey) {
      return { valid: false, error: 'تعذر استخراج مفتاح الملف من الرابط' };
    }

    try {
      const exists = await this.fileExists(fileKey);
      if (!exists) {
        return { valid: false, fileKey, error: `الملف ${fileKey} غير موجود في التخزين` };
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const freshUrl = await getSignedUrl(this.client!, command, { expiresIn: 604800 });
      return { valid: true, freshUrl, fileKey };
    } catch (error: any) {
      return { valid: false, fileKey, error: error.message };
    }
  }
}

export const r2Storage = new R2StorageService();
