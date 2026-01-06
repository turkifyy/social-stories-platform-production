/**
 * Comprehensive Error Handling & Recovery System
 * 
 * Handles:
 * 1. Error validation and logging
 * 2. Rate limiting protection
 * 3. Token expiration detection
 * 4. URL/File validation
 * 5. Retry strategies
 * 6. Error recovery mechanisms
 */

import type { LinkedAccount, Story } from '@shared/schema';
import { firestoreService } from './firestore';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  facebook: { requestsPerMinute: 200, requestsPerDay: 50000 },
  instagram: { requestsPerMinute: 200, requestsPerDay: 50000 },
  tiktok: { requestsPerMinute: 100, requestsPerDay: 10000 },
};

// Track requests per platform
const requestTracking = new Map<string, {
  lastResetTime: Date;
  requestCount: number;
  dailyCount: number;
}>();

export class PublishingErrorHandler {
  /**
   * Validate if a URL is properly formatted
   */
  static isValidUrl(url: string | undefined): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  static isTokenExpired(account: LinkedAccount): boolean {
    if (!account.tokenExpiresAt) {
      // If no expiration info, assume valid
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);
    const bufferMinutes = 5; // Refresh 5 minutes before expiry
    
    return now.getTime() >= (expiresAt.getTime() - bufferMinutes * 60 * 1000);
  }

  /**
   * Get friendly error message for different error types
   */
  static getFriendlyErrorMessage(error: any, context?: string): string {
    const errorMessage = error.message || error.toString();

    // Rate limiting errors
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      return 'تم تجاوز حد المعدل المسموح به. يرجى المحاولة مجددا لاحقا.';
    }

    // Token expiration errors
    if (errorMessage.includes('190') || errorMessage.includes('invalid_token') || errorMessage.includes('expired')) {
      return 'انتهت صلاحية رمز الدخول. يرجى تحديث الحساب.';
    }

    // Permission errors
    if (errorMessage.includes('10') || errorMessage.includes('200') || errorMessage.includes('permission')) {
      return 'صلاحيات غير كافية. تأكد من منح الإذن المطلوب.';
    }

    // URL validation errors
    if (errorMessage.includes('Invalid URL') || errorMessage.includes('malformed')) {
      return 'رابط الملف غير صالح. تأكد من أن الرابط يبدأ بـ http:// أو https://';
    }

    // File not found errors
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return 'الملف غير موجود أو تم حذفه. قد تكون الرابط قد انتهت صلاحيته.';
    }

    // Network errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      return 'خطأ في الاتصال بالإنترنت. تأكد من اتصالك ثم حاول مجددا.';
    }

    // R2 storage errors
    if (errorMessage.includes('NoSuchKey') || errorMessage.includes('r2')) {
      return 'الملف غير موجود في التخزين السحابي. قد يكون قد تم حذفه.';
    }

    // Media type errors
    if (errorMessage.includes('MEDIA_TYPE_INVALID') || errorMessage.includes('media_type')) {
      return 'نوع الملف غير مدعوم. استخدم صورة أو فيديو.';
    }

    return `حدث خطأ: ${errorMessage}`;
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: any): boolean {
    const message = (error.message || error.toString()).toLowerCase();

    // Don't retry permission errors
    if (message.includes('permission') || message.includes('403') || message.includes('unauthorized')) {
      return false;
    }

    // Don't retry invalid content errors
    if (message.includes('invalid') && message.includes('media')) {
      return false;
    }

    // Don't retry token errors (need manual refresh)
    if (message.includes('token') && message.includes('invalid')) {
      return false;
    }

    // Retry network errors
    if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('timeout')) {
      return true;
    }

    // Retry rate limit errors
    if (message.includes('429') || message.includes('rate_limit')) {
      return true;
    }

    // Retry server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Get retry delay with exponential backoff
   */
  static getRetryDelay(retryCount: number, maxDelay: number = 60000): number {
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * Check if account should have rate limiting
   */
  static shouldRateLimit(platform: string, accountId: string): boolean {
    const key = `${platform}:${accountId}`;
    const tracking = requestTracking.get(key);
    
    if (!tracking) {
      return false;
    }

    const config = RATE_LIMIT_CONFIG[platform as keyof typeof RATE_LIMIT_CONFIG];
    if (!config) return false;

    const now = new Date();
    const timeSinceReset = now.getTime() - tracking.lastResetTime.getTime();
    
    // Reset minute counter every 60 seconds
    if (timeSinceReset > 60000) {
      tracking.requestCount = 0;
      tracking.lastResetTime = now;
    }

    // Reset daily counter every 24 hours
    if (timeSinceReset > 24 * 60 * 60 * 1000) {
      tracking.dailyCount = 0;
    }

    return tracking.requestCount >= config.requestsPerMinute || 
           tracking.dailyCount >= config.requestsPerDay;
  }

  /**
   * Track API request for rate limiting
   */
  static trackRequest(platform: string, accountId: string): void {
    const key = `${platform}:${accountId}`;
    const tracking = requestTracking.get(key);

    if (!tracking) {
      requestTracking.set(key, {
        lastResetTime: new Date(),
        requestCount: 1,
        dailyCount: 1,
      });
    } else {
      tracking.requestCount++;
      tracking.dailyCount++;
    }
  }

  /**
   * Validate story before publishing
   */
  static async validateStoryForPublishing(story: Story, account: LinkedAccount): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check if account is active
    if (account.status !== 'active') {
      errors.push(`الحساب "${account.name}" غير نشط`);
    }

    // Check if token is expired
    if (this.isTokenExpired(account)) {
      errors.push(`انتهت صلاحية رمز الدخول للحساب "${account.name}". يرجى التحديث.`);
    }

    // Check media URL validity
    if (story.mediaUrl && !this.isValidUrl(story.mediaUrl)) {
      errors.push(`رابط الملف غير صالح: ${story.mediaUrl}`);
    }

    // Check platform compatibility
    if (!story.platforms.includes(account.platform)) {
      errors.push(`المنصة ${account.platform} غير محددة للقصة`);
    }

    // Check media type
    if (!story.mediaType) {
      errors.push('يجب تحديد نوع الوسائط (صورة أو فيديو)');
    }

    // Check quotas
    if (account.quotas) {
      if (account.quotas.dailyUsed >= account.quotas.dailyLimit) {
        errors.push(`تم الوصول إلى حد النشر اليومي (${account.quotas.dailyLimit})`);
      }
      if (account.quotas.monthlyUsed >= account.quotas.monthlyLimit) {
        errors.push(`تم الوصول إلى حد النشر الشهري (${account.quotas.monthlyLimit})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log publishing error with context
   */
  static async logPublishingError(
    storyId: string,
    accountId: string,
    platform: string,
    error: any,
    context?: Record<string, any>
  ): Promise<void> {
    const errorData = {
      timestamp: new Date(),
      storyId,
      accountId,
      platform,
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      context: context || {},
    };

    try {
      console.error('❌ Publishing Error:', errorData);
      
      // Store error in Firestore for debugging (optional - silently fail if not available)
      // Note: logError is not a standard method, so we skip it
    } catch (logError) {
      console.error('Failed to log publishing error:', logError);
    }
  }

  /**
   * Handle account token refresh
   */
  static async refreshAccountTokenIfNeeded(account: LinkedAccount): Promise<LinkedAccount | null> {
    if (!this.isTokenExpired(account)) {
      return account;
    }

    try {
      console.log(`🔄 Refreshing token for account: ${account.name}`);

      if (account.platform === 'facebook' || account.platform === 'instagram') {
        const { facebookSDK } = await import('./sdk/facebook');
        const tokenData = await facebookSDK.getLongLivedToken(account.accessToken);
        const expiresIn = tokenData.expires_in || 5184000; // 60 days default
        
        await firestoreService.updateLinkedAccount(account.id, {
          accessToken: tokenData.access_token,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        });
        
        return {
          ...account,
          accessToken: tokenData.access_token,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        };
      } else if (account.platform === 'tiktok' && account.refreshToken) {
        const { tiktokSDK } = await import('./sdk/tiktok');
        const tokenData = await tiktokSDK.refreshAccessToken(account.refreshToken);
        const expiresIn = tokenData.expires_in || 2592000; // 30 days default
        
        await firestoreService.updateLinkedAccount(account.id, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || account.refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        });
        
        return {
          ...account,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || account.refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        };
      }
    } catch (error) {
      console.error(`Failed to refresh token for account ${account.id}:`, error);
      
      // Mark account as expired
      await firestoreService.updateLinkedAccount(account.id, {
        status: 'expired',
      }).catch(() => {});
    }

    return null;
  }

  /**
   * Get wait time before retrying rate-limited request
   */
  static getRateLimitWaitTime(platform: string, accountId: string): number {
    const key = `${platform}:${accountId}`;
    const tracking = requestTracking.get(key);
    
    if (!tracking) return 0;

    const config = RATE_LIMIT_CONFIG[platform as keyof typeof RATE_LIMIT_CONFIG];
    if (!config) return 0;

    // Calculate backoff based on how much we exceeded the limit
    const exceededBy = tracking.requestCount - config.requestsPerMinute;
    if (exceededBy <= 0) return 0;

    // Wait longer the more we've exceeded
    return Math.min(exceededBy * 5000, 60000); // Max 60 seconds
  }

  /**
   * Clear all tracking data
   */
  static clearTracking(): void {
    requestTracking.clear();
  }
}

export const publishingErrorHandler = new PublishingErrorHandler();
