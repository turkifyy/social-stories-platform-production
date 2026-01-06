import { firestoreService } from '../firestore';

const INSTAGRAM_API_VERSION = 'v22.0';
const INSTAGRAM_BASE_URL = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

interface InstagramMediaContainer {
  image_url?: string;
  video_url?: string;
  caption?: string;
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'REELS';
  cover_url?: string;
  share_to_feed?: boolean;
}

interface InstagramStory {
  image_url?: string;
  video_url?: string;
  media_type: 'STORIES';
}

export class InstagramSDK {
  private appId: string = '';
  private appSecret: string = '';
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;
    
    const config = await firestoreService.getAPIConfig('instagram');
    if (config && config.appId && config.appSecret) {
      this.appId = config.appId;
      this.appSecret = config.appSecret;
      this.initialized = true;
    }
  }

  async getAppAccessToken(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${INSTAGRAM_BASE_URL}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get Instagram access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${INSTAGRAM_BASE_URL}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code: code,
      grant_type: 'authorization_code',
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async getUserProfile(igUserId: string, accessToken: string) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}`;
    const params = new URLSearchParams({
      fields: 'id,username,account_type,media_count,followers_count,follows_count',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    return await response.json();
  }

  async createMediaContainer(igUserId: string, accessToken: string, mediaData: InstagramMediaContainer) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/media`;
    
    const body: any = {
      access_token: accessToken,
      ...mediaData,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create media container: ${error}`);
    }

    const data = await response.json();
    return data.id;
  }

  async publishMedia(igUserId: string, accessToken: string, creationId: string) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/media_publish`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to publish media: ${error}`);
    }

    return await response.json();
  }

  async publishPost(igUserId: string, accessToken: string, mediaData: InstagramMediaContainer) {
    const creationId = await this.createMediaContainer(igUserId, accessToken, mediaData);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.publishMedia(igUserId, accessToken, creationId);
  }

  async publishReel(igUserId: string, accessToken: string, videoUrl: string, caption?: string, coverUrl?: string, shareToFeed: boolean = true) {
    const mediaData: InstagramMediaContainer = {
      video_url: videoUrl,
      caption: caption,
      media_type: 'REELS',
      cover_url: coverUrl,
      share_to_feed: shareToFeed,
    };

    return await this.publishPost(igUserId, accessToken, mediaData);
  }

  async publishStory(igUserId: string, accessToken: string, storyData: InstagramStory) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/media`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...storyData,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish story: ${response.statusText}`);
    }

    const data = await response.json();
    
    return await this.publishMedia(igUserId, accessToken, data.id);
  }

  async getMediaInsights(mediaId: string, accessToken: string) {
    const url = `${INSTAGRAM_BASE_URL}/${mediaId}/insights`;
    const params = new URLSearchParams({
      metric: 'impressions,reach,engagement,saved,likes,comments,shares,plays,total_interactions',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get media insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserInsights(igUserId: string, accessToken: string, metric: string[] = ['impressions', 'reach', 'follower_count', 'profile_views']) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/insights`;
    const params = new URLSearchParams({
      metric: metric.join(','),
      period: 'day',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserMedia(igUserId: string, accessToken: string, limit: number = 25) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/media`;
    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url',
      limit: limit.toString(),
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user media: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteMedia(mediaId: string, accessToken: string) {
    const url = `${INSTAGRAM_BASE_URL}/${mediaId}`;
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete media: ${response.statusText}`);
    }

    return await response.json();
  }

  async getComments(mediaId: string, accessToken: string) {
    const url = `${INSTAGRAM_BASE_URL}/${mediaId}/comments`;
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get comments: ${response.statusText}`);
    }

    return await response.json();
  }

  async replyToComment(commentId: string, accessToken: string, message: string) {
    const url = `${INSTAGRAM_BASE_URL}/${commentId}/replies`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reply to comment: ${response.statusText}`);
    }

    return await response.json();
  }

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    if (!this.appId || !this.appSecret) {
      await this.initialize();
    }

    const url = `${INSTAGRAM_BASE_URL}/access_token`;
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.appSecret,
      access_token: shortLivedToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to exchange for long-lived token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async refreshLongLivedToken(longLivedToken: string): Promise<string> {
    const url = `${INSTAGRAM_BASE_URL}/refresh_access_token`;
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: longLivedToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to refresh long-lived token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async verifyAccessToken(accessToken: string): Promise<boolean> {
    try {
      const url = `${INSTAGRAM_BASE_URL}/me`;
      const params = new URLSearchParams({
        fields: 'id',
        access_token: accessToken,
      });
      const response = await fetch(`${url}?${params.toString()}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async refreshToken(accessToken: string): Promise<string | null> {
    try {
      return await this.refreshLongLivedToken(accessToken);
    } catch (error: any) {
      console.error('Error refreshing Instagram token:', error.message);
      return null;
    }
  }

  async getHashtagId(igUserId: string, accessToken: string, hashtag: string): Promise<string> {
    const url = `${INSTAGRAM_BASE_URL}/ig_hashtag_search`;
    const params = new URLSearchParams({
      user_id: igUserId,
      q: hashtag,
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get hashtag ID: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0]?.id;
  }

  async getHashtagTopMedia(hashtagId: string, igUserId: string, accessToken: string, limit: number = 25) {
    const url = `${INSTAGRAM_BASE_URL}/${hashtagId}/top_media`;
    const params = new URLSearchParams({
      user_id: igUserId,
      fields: 'id,caption,media_type,media_url,permalink,timestamp',
      limit: limit.toString(),
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get hashtag top media: ${response.statusText}`);
    }

    return await response.json();
  }

  async getAccountInsights(igUserId: string, accessToken: string, period: 'day' | 'week' | 'days_28' = 'day', metrics: string[] = ['impressions', 'reach', 'profile_views', 'follower_count']) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/insights`;
    const params = new URLSearchParams({
      metric: metrics.join(','),
      period: period,
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get account insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async getStories(igUserId: string, accessToken: string) {
    const url = `${INSTAGRAM_BASE_URL}/${igUserId}/stories`;
    const params = new URLSearchParams({
      fields: 'id,media_type,media_url,permalink,timestamp',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get stories: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const instagramSDK = new InstagramSDK();
