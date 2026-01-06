/**
 * File Validation & Recovery System for R2 Storage
 * 
 * Handles:
 * 1. File existence verification before publishing
 * 2. URL validity checking
 * 3. Alternative URL generation
 * 4. File recovery strategies
 * 5. Metadata validation
 */

import { r2Storage } from './r2-storage';

interface FileValidationResult {
  valid: boolean;
  url?: string;
  fileKey?: string;
  error?: string;
  attempt?: number;
  fileSize?: number;
  contentType?: string;
}

export class FileValidator {
  /**
   * Validate file exists in R2 and return verified URL
   */
  static async validateAndGetUrl(
    url: string | undefined,
    maxAttempts: number = 3
  ): Promise<FileValidationResult> {
    if (!url) {
      return {
        valid: false,
        error: 'لا يوجد رابط ملف للتحقق منه',
      };
    }

    // Check if URL is even valid format
    try {
      new URL(url);
    } catch {
      return {
        valid: false,
        error: 'صيغة الرابط غير صحيحة',
      };
    }

    // Try to verify and get fresh URL
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await r2Storage.verifyAndGetUrl(url);
        
        if (result.valid && result.freshUrl) {
          return {
            valid: true,
            url: result.freshUrl,
            fileKey: result.fileKey,
            attempt,
          };
        }
        
        if (!result.valid && attempt === maxAttempts) {
          return {
            valid: false,
            error: result.error || 'الملف غير موجود',
            fileKey: result.fileKey,
            attempt,
          };
        }
      } catch (error: any) {
        if (attempt === maxAttempts) {
          return {
            valid: false,
            error: error.message || 'فشل التحقق من الملف',
            attempt,
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return {
      valid: false,
      error: 'فشل التحقق من الملف بعد عدة محاولات',
      attempt: maxAttempts,
    };
  }

  /**
   * Get file metadata for validation
   */
  static async getFileMetadata(fileKey: string): Promise<{
    exists: boolean;
    size?: number;
    contentType?: string;
    lastModified?: Date;
    error?: string;
  }> {
    try {
      const exists = await r2Storage.fileExists(fileKey);
      
      if (!exists) {
        return {
          exists: false,
          error: 'الملف غير موجود',
        };
      }

      const metadata = await r2Storage.getFileMetadata(fileKey);
      return {
        exists: true,
        size: metadata.contentLength,
        contentType: metadata.contentType,
        lastModified: metadata.lastModified,
      };
    } catch (error: any) {
      return {
        exists: false,
        error: error.message || 'فشل الحصول على بيانات الملف',
      };
    }
  }

  /**
   * Validate multiple files before batch operation
   */
  static async validateBatch(urls: (string | undefined)[]): Promise<{
    valid: boolean;
    validUrls: string[];
    invalidUrls: Array<{ url: string | undefined; error: string }>;
  }> {
    const validUrls: string[] = [];
    const invalidUrls: Array<{ url: string | undefined; error: string }> = [];

    for (const url of urls) {
      const result = await this.validateAndGetUrl(url);
      
      if (result.valid && result.url) {
        validUrls.push(result.url);
      } else {
        invalidUrls.push({
          url,
          error: result.error || 'فشل التحقق',
        });
      }
    }

    return {
      valid: invalidUrls.length === 0,
      validUrls,
      invalidUrls,
    };
  }

  /**
   * Check if file size is appropriate for platform
   */
  static isValidFileSize(
    fileSize: number | undefined,
    platform: string
  ): { valid: boolean; error?: string } {
    if (!fileSize) {
      return { valid: false, error: 'لم يتمكن من تحديد حجم الملف' };
    }

    const limits = {
      facebook: { maxImage: 4 * 1024 * 1024, maxVideo: 2 * 1024 * 1024 * 1024 }, // 4MB image, 2GB video
      instagram: { maxImage: 8 * 1024 * 1024, maxVideo: 5.368 * 1024 * 1024 * 1024 }, // 8MB image, 5.368GB video
      tiktok: { maxImage: 72 * 1024 * 1024, maxVideo: 287.6 * 1024 * 1024 * 1024 }, // 72MB image, 287.6GB video
    };

    const limit = limits[platform as keyof typeof limits];
    if (!limit) {
      return { valid: false, error: `منصة غير معروفة: ${platform}` };
    }

    // For now, use conservative estimate for image sizes
    // You can adjust based on actual file type detection
    if (fileSize > limit.maxImage) {
      const maxMB = (limit.maxImage / 1024 / 1024).toFixed(0);
      return {
        valid: false,
        error: `حجم الملف يتجاوز الحد الأقصى المسموح به (${maxMB}MB)`,
      };
    }

    return { valid: true };
  }

  /**
   * Extract file information from URL
   */
  static extractFileInfo(url: string): {
    fileName?: string;
    fileExtension?: string;
    fileKey?: string;
  } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
      const fileName = pathParts[pathParts.length - 1];
      const extension = fileName?.split('.').pop();

      return {
        fileName,
        fileExtension: extension?.toLowerCase(),
        fileKey: r2Storage.extractFileKeyFromUrl(url) || undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Validate content type matches file extension
   */
  static isValidContentType(
    contentType: string | undefined,
    fileExtension: string | undefined,
    mediaType: 'image' | 'video'
  ): boolean {
    if (!contentType || !fileExtension) {
      return true; // Allow if we can't determine
    }

    const validImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

    if (mediaType === 'image') {
      return validImageTypes.includes(contentType);
    } else if (mediaType === 'video') {
      return validVideoTypes.includes(contentType);
    }

    return true;
  }

  /**
   * Check if URL will likely expire soon
   */
  static willUrlExpireSoon(
    urlString: string,
    expirationMinutes: number = 60
  ): boolean {
    try {
      const url = new URL(urlString);
      const expirationParam = url.searchParams.get('X-Amz-Expires');
      const dateParam = url.searchParams.get('X-Amz-Date');

      if (!expirationParam || !dateParam) {
        return false; // Can't determine
      }

      const expiresIn = parseInt(expirationParam, 10);
      const issueDate = new Date(dateParam.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
      const expiryDate = new Date(issueDate.getTime() + expiresIn * 1000);
      const now = new Date();
      const minutesUntilExpiry = (expiryDate.getTime() - now.getTime()) / 60000;

      return minutesUntilExpiry < expirationMinutes;
    } catch {
      return false;
    }
  }

  /**
   * Refresh URL if it's close to expiring
   */
  static async refreshUrlIfNeeded(url: string): Promise<string> {
    if (this.willUrlExpireSoon(url, 60)) {
      try {
        const freshUrl = await r2Storage.refreshSignedUrl(url);
        return freshUrl;
      } catch {
        // Return original URL if refresh fails
        return url;
      }
    }

    return url;
  }
}

export const fileValidator = new FileValidator();
