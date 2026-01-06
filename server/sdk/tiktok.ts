import { firestoreService } from '../firestore';

const TIKTOK_API_VERSION = 'v2';
const TIKTOK_BASE_URL = `https://open.tiktokapis.com/${TIKTOK_API_VERSION}`;

interface TikTokVideoUpload {
  post_info: {
    title: string;
    privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
    disable_duet?: boolean;
    disable_comment?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
  };
  source_info: {
    source: 'FILE_UPLOAD' | 'PULL_FROM_URL';
    video_url?: string;
    video_size?: number;
    chunk_size?: number;
    total_chunk_count?: number;
  };
}

interface TikTokPhotoPost {
  post_info: {
    title: string;
    description?: string;
    privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
    auto_add_music?: boolean;
    disable_comment?: boolean;
  };
  source_info: {
    source: 'PULL_FROM_URL';
    photo_cover_index?: number;
    photo_images: string[];
  };
  post_mode: 'DIRECT_POST' | 'MEDIA_UPLOAD';
  media_type: 'PHOTO';
}

interface TikTokAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class TikTokSDK {
  private clientKey: string = '';
  private clientSecret: string = '';
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;
    
    const config = await firestoreService.getAPIConfig('tiktok');
    if (config && config.apiKey && config.appSecret) {
      this.clientKey = config.apiKey;
      this.clientSecret = config.appSecret;
      this.initialized = true;
    }
  }

  async getClientAccessToken(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${TIKTOK_BASE_URL}/oauth/token/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get TikTok access token: ${response.statusText}`);
    }

    const data: TikTokAuthResponse = await response.json();
    return data.access_token;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<TikTokAuthResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${TIKTOK_BASE_URL}/oauth/token/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    return await response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokAuthResponse> {
    if (!this.clientKey || !this.clientSecret) {
      await this.initialize();
    }

    const url = `${TIKTOK_BASE_URL}/oauth/token/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to refresh access token: ${errorText}`);
    }

    return await response.json();
  }

  async getUserInfo(accessToken: string) {
    const url = `${TIKTOK_BASE_URL}/user/info/`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return await response.json();
  }

  async getCreatorInfo(accessToken: string) {
    const url = `${TIKTOK_BASE_URL}/post/creator/info/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to get creator info: ${response.statusText}`);
    }

    return await response.json();
  }

  async initializeVideoUpload(accessToken: string, videoData: TikTokVideoUpload) {
    const url = `${TIKTOK_BASE_URL}/post/publish/video/init/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to initialize video upload: ${error}`);
    }

    return await response.json();
  }

  async publishVideoFromUrl(accessToken: string, videoUrl: string, title: string, privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' = 'PUBLIC_TO_EVERYONE') {
    const videoData: TikTokVideoUpload = {
      post_info: {
        title: title,
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    };

    return await this.initializeVideoUpload(accessToken, videoData);
  }

  async publishPhotoPost(accessToken: string, photoUrls: string | string[], title: string, description?: string, privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' = 'PUBLIC_TO_EVERYONE') {
    const url = `${TIKTOK_BASE_URL}/post/publish/content/init/`;
    
    const photoArray = Array.isArray(photoUrls) ? photoUrls : [photoUrls];
    
    if (photoArray.length < 2) {
      photoArray.push(photoArray[0]);
    }
    
    const photoData: TikTokPhotoPost = {
      post_info: {
        title: title,
        description: description,
        privacy_level: privacyLevel,
        auto_add_music: true,
        disable_comment: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 1,
        photo_images: photoArray.slice(0, 35),
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(photoData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to publish photo post: ${error}`);
    }

    return await response.json();
  }

  async getVideoList(accessToken: string, cursor?: number, maxCount: number = 20) {
    const url = `${TIKTOK_BASE_URL}/video/list/`;
    
    const body: any = {
      max_count: maxCount,
    };
    
    if (cursor) {
      body.cursor = cursor;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to get video list: ${response.statusText}`);
    }

    return await response.json();
  }

  async getVideoInsights(accessToken: string, videoIds: string[]) {
    const url = `${TIKTOK_BASE_URL}/video/query/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          video_ids: videoIds,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get video insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserAnalytics(accessToken: string, startDate: string, endDate: string) {
    const url = `${TIKTOK_BASE_URL}/research/user/info/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get user analytics: ${response.statusText}`);
    }

    return await response.json();
  }

  async getCommentList(accessToken: string, videoId: string, cursor?: number, maxCount: number = 20) {
    const url = `${TIKTOK_BASE_URL}/comment/list/`;
    
    const body: any = {
      video_id: videoId,
      max_count: maxCount,
    };
    
    if (cursor) {
      body.cursor = cursor;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to get comment list: ${response.statusText}`);
    }

    return await response.json();
  }

  async replyToComment(accessToken: string, commentId: string, videoId: string, text: string) {
    const url = `${TIKTOK_BASE_URL}/comment/reply/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment_id: commentId,
        video_id: videoId,
        text: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reply to comment: ${response.statusText}`);
    }

    return await response.json();
  }

  async checkPublishStatus(accessToken: string, publishId: string) {
    const url = `${TIKTOK_BASE_URL}/post/publish/status/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check publish status: ${response.statusText}`);
    }

    return await response.json();
  }

  async revokeAccessToken(accessToken: string) {
    if (!this.clientKey) {
      await this.initialize();
    }

    const url = `${TIKTOK_BASE_URL}/oauth/revoke/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to revoke access token: ${response.statusText}`);
    }

    return await response.json();
  }

  async verifyAccessToken(accessToken: string): Promise<boolean> {
    try {
      const result = await this.getUserInfo(accessToken);
      return !!result.data?.user;
    } catch {
      return false;
    }
  }

  async refreshToken(refreshToken: string): Promise<TikTokAuthResponse | null> {
    try {
      return await this.refreshAccessToken(refreshToken);
    } catch (error: any) {
      console.error('Error refreshing TikTok token:', error.message);
      return null;
    }
  }

  async getVideoQuery(accessToken: string, filters: { video_ids?: string[]; max_count?: number }) {
    const url = `${TIKTOK_BASE_URL}/video/query/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          ...filters,
          max_count: filters.max_count || 20,
        },
        fields: ['id', 'create_time', 'cover_image_url', 'share_url', 'video_description', 'duration', 'height', 'width', 'title', 'embed_html', 'embed_link', 'like_count', 'comment_count', 'share_count', 'view_count'],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to query videos: ${response.statusText}`);
    }

    return await response.json();
  }

  async shareInsights(accessToken: string, videoId: string, metrics: string[] = ['LIKES', 'COMMENTS', 'SHARES', 'VIEWS']) {
    const url = `${TIKTOK_BASE_URL}/video/query/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: {
          video_ids: [videoId],
        },
        fields: metrics.map(m => m.toLowerCase() + '_count'),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get share insights: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const tiktokSDK = new TikTokSDK();
