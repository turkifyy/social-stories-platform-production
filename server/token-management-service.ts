import { firestoreService } from './firestore';
import { facebookSDK } from './sdk/facebook';
import { instagramSDK } from './sdk/instagram';
import { tiktokSDK } from './sdk/tiktok';
import type { LinkedAccount } from '@shared/schema';

export class TokenManagementService {
  private readonly REFRESH_THRESHOLD_DAYS = 7;
  private readonly CRITICAL_THRESHOLD_HOURS = 24;

  async processAllTokens() {
    console.log('🤖 Starting Smart Token Management Algorithm...');
    const users = await firestoreService.getAllUsers();
    
    for (const user of users) {
      await this.manageUserTokens(user.id);
    }
  }

  async manageUserTokens(userId: string) {
    const accounts = await firestoreService.getLinkedAccountsByUser(userId);
    
    for (const account of accounts) {
      try {
        await this.evaluateAndRefresh(account);
      } catch (error: any) {
        console.error(`❌ Error managing token for ${account.platform}:${account.name}:`, error.message);
      }
    }
  }

  private async evaluateAndRefresh(account: LinkedAccount) {
    const now = Date.now();
    const expiresAt = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() : 0;
    const timeRemaining = expiresAt - now;
    
    // Status-based refresh
    if (account.status === 'expired' || account.status === 'error') {
      return await this.attemptRefresh(account, 'RECOVERY');
    }

    // Proactive health check
    const isValid = await this.verifyTokenHealth(account);
    if (!isValid) {
      return await this.attemptRefresh(account, 'HEALTH_FAILURE');
    }

    // Time-based proactive refresh
    if (expiresAt > 0) {
      if (timeRemaining < this.CRITICAL_THRESHOLD_HOURS * 60 * 60 * 1000) {
        return await this.attemptRefresh(account, 'CRITICAL_EXPIRY');
      }
      if (timeRemaining < this.REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
        return await this.attemptRefresh(account, 'PROACTIVE_RENEWAL');
      }
    }
  }

  private async verifyTokenHealth(account: LinkedAccount): Promise<boolean> {
    try {
      if (account.platform === 'facebook') return (await facebookSDK.verifyAccessToken(account.accessToken)).is_valid;
      if (account.platform === 'instagram') return await instagramSDK.verifyAccessToken(account.accessToken);
      if (account.platform === 'tiktok') return await tiktokSDK.verifyAccessToken(account.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  private async attemptRefresh(account: LinkedAccount, reason: string) {
    console.log(`🔄 [${reason}] Attempting smart refresh for ${account.platform}:${account.name}`);
    
    let newToken: string | null = null;
    let newRefreshToken: string | null = null;
    let expiresIn: number | null = null;

    try {
      if (account.platform === 'facebook') {
        newToken = await facebookSDK.refreshToken(account.accessToken);
        expiresIn = 60 * 24 * 60 * 60; // 60 days
      } else if (account.platform === 'instagram') {
        newToken = await instagramSDK.refreshToken(account.accessToken);
        expiresIn = 60 * 24 * 60 * 60;
      } else if (account.platform === 'tiktok' && account.refreshToken) {
        const res = await tiktokSDK.refreshToken(account.refreshToken);
        if (res) {
          newToken = res.access_token;
          newRefreshToken = res.refresh_token || account.refreshToken;
          expiresIn = res.expires_in;
        }
      }

      if (newToken) {
        await firestoreService.updateLinkedAccount(account.id, {
          accessToken: newToken,
          refreshToken: newRefreshToken || undefined,
          status: 'active',
          tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
          lastSyncedAt: new Date()
        });
        console.log(`✅ Successfully refreshed ${account.platform} token for ${account.name}`);
      } else {
        throw new Error('SDK returned empty token');
      }
    } catch (err: any) {
      console.error(`❌ Smart refresh failed for ${account.name}:`, err.message);
      if (reason === 'CRITICAL_EXPIRY' || reason === 'HEALTH_FAILURE') {
        await firestoreService.updateLinkedAccount(account.id, { status: 'expired' });
      }
    }
  }
}

export const tokenManagementService = new TokenManagementService();
