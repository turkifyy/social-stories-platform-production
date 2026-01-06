import { firestoreService } from '../firestore';

const FACEBOOK_API_VERSION = 'v22.0';
const FACEBOOK_BASE_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

interface FacebookPost {
  message?: string;
  link?: string;
  published?: boolean;
  scheduled_publish_time?: number;
}

interface FacebookMedia {
  source?: string;
  url?: string;
  published?: boolean;
  caption?: string;
}

interface FacebookAuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  access_token: string;
}

interface FacebookLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookReelsUpload {
  video_url: string;
  description?: string;
  title?: string;
}

interface FacebookStory {
  photo_url?: string;
  video_url?: string;
}

export class FacebookSDK {
  private appId: string = '';
  private appSecret: string = '';
  private accessToken: string = '';
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;
    
    const config = await firestoreService.getAPIConfig('facebook');
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

    const url = `${FACEBOOK_BASE_URL}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get Facebook access token: ${response.statusText}`);
    }

    const data: FacebookAuthResponse = await response.json();
    this.accessToken = data.access_token;
    return data.access_token;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const url = `${FACEBOOK_BASE_URL}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code: code,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data: FacebookAuthResponse = await response.json();
    return data.access_token;
  }

  async getUserProfile(accessToken: string) {
    const url = `${FACEBOOK_BASE_URL}/me`;
    const params = new URLSearchParams({
      fields: 'id,name,email,picture',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    return await response.json();
  }

  async publishPost(pageId: string, accessToken: string, postData: FacebookPost) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/feed`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...postData,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish post: ${response.statusText}`);
    }

    return await response.json();
  }

  async schedulePost(pageId: string, accessToken: string, postData: FacebookPost, scheduledTime: Date) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/feed`;
    const scheduledTimestamp = Math.floor(scheduledTime.getTime() / 1000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...postData,
        published: false,
        scheduled_publish_time: scheduledTimestamp,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to schedule post: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadPhoto(pageId: string, accessToken: string, photoUrl: string, caption?: string) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/photos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: photoUrl,
        caption: caption,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to upload photo: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadVideo(pageId: string, accessToken: string, videoUrl: string, description?: string) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/videos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_url: videoUrl,
        description: description,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to upload video: ${response.statusText}`);
    }

    return await response.json();
  }

  async getPageInsights(pageId: string, accessToken: string, metrics: string[] = ['page_impressions', 'page_engaged_users']) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/insights`;
    const params = new URLSearchParams({
      metric: metrics.join(','),
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get page insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async getPostInsights(postId: string, accessToken: string) {
    const url = `${FACEBOOK_BASE_URL}/${postId}/insights`;
    const params = new URLSearchParams({
      metric: 'post_impressions,post_engaged_users,post_reactions_by_type_total',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get post insights: ${response.statusText}`);
    }

    return await response.json();
  }

  async deletePost(postId: string, accessToken: string) {
    const url = `${FACEBOOK_BASE_URL}/${postId}`;
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete post: ${response.statusText}`);
    }

    return await response.json();
  }

  async getLongLivedToken(shortLivedToken: string): Promise<FacebookLongLivedTokenResponse> {
    if (!this.appId || !this.appSecret) {
      await this.initialize();
    }

    const url = `${FACEBOOK_BASE_URL}/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get long-lived token: ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserPages(accessToken: string): Promise<FacebookPage[]> {
    const url = `${FACEBOOK_BASE_URL}/me/accounts`;
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,category,access_token',
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user pages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async getPageInstagramAccount(pageId: string, accessToken: string) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}`;
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'instagram_business_account',
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get page instagram account: ${response.statusText}`);
    }

    return await response.json();
  }

  async publishReel(pageId: string, accessToken: string, reelData: FacebookReelsUpload) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/video_reels`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        upload_phase: 'start',
        video_url: reelData.video_url,
        description: reelData.description,
        title: reelData.title,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish reel: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadUnpublishedPhoto(pageId: string, accessToken: string, photoUrl: string): Promise<string> {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/photos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: photoUrl,
        published: false,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText;
      const errorCode = errorData?.error?.code;
      
      if (errorCode === 190) {
        throw new Error(`رمز الوصول منتهي الصلاحية أو غير صالح. يرجى إعادة ربط حساب Facebook.`);
      }
      if (errorCode === 10) {
        throw new Error(`لا تملك صلاحية نشر الصور على هذه الصفحة. تأكد من منح إذن pages_manage_posts.`);
      }
      throw new Error(`فشل رفع الصورة: ${errorMessage}`);
    }

    const data = await response.json();
    return data.id;
  }

  async publishPhotoStory(pageId: string, accessToken: string, photoUrl: string) {
    console.log(`\n         📸 === FACEBOOK PHOTO STORY ===`);
    console.log(`            Page ID: ${pageId}`);
    console.log(`            Photo URL: ${photoUrl.substring(0, 80)}...`);
    console.log(`            Duration: 20 seconds`);
    
    try {
      console.log(`            🔄 Step 1: Uploading photo as unpublished...`);
      const photoId = await this.uploadUnpublishedPhoto(pageId, accessToken, photoUrl);
      console.log(`            ✅ Photo uploaded. Photo ID: ${photoId}`);
      
      console.log(`            🔄 Step 2: Publishing story using photo_id...`);
      const url = `${FACEBOOK_BASE_URL}/${pageId}/photo_stories`;
      console.log(`            API Endpoint: ${url}`);
      
      const requestBody = {
        photo_id: photoId,
        duration: 20,
        access_token: accessToken,
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`            HTTP Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || response.statusText;
        const errorCode = errorData?.error?.code;
        
        console.log(`            ❌ API Error: Code ${errorCode} - ${errorMessage}`);
        
        if (errorCode === 1) {
          throw new Error(`خطأ غير معروف من Facebook. تأكد من:\n1. موافقة Facebook على ميزة "Page Stories" في App Review\n2. الحصول على إذن pages_manage_posts\n3. أن التطبيق موثق من Facebook`);
        }
        if (errorCode === 190) {
          throw new Error(`رمز الوصول منتهي الصلاحية. يرجى إعادة ربط حساب Facebook.`);
        }
        if (errorCode === 10 || errorCode === 200) {
          throw new Error(`صلاحيات غير كافية. تأكد من الحصول على إذن pages_manage_posts وموافقة "Page Stories".`);
        }
        throw new Error(`فشل نشر القصة: ${errorMessage} (كود: ${errorCode})`);
      }

      const result = await response.json();
      console.log(`            ✅ STORY PUBLISHED SUCCESSFULLY!`);
      console.log(`            Response: ${JSON.stringify(result)}`);
      return result;
    } catch (error: any) {
      console.error(`            ❌ Method 1 (photo_id) failed: ${error.message}`);
      
      console.log(`            🔄 Attempting Method 2: Publishing with photo_url directly...`);
      const url = `${FACEBOOK_BASE_URL}/${pageId}/photo_stories`;
      
      const requestBody = {
        photo_url: photoUrl,
        duration: 20,
        access_token: accessToken,
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`            HTTP Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || response.statusText;
        const errorCode = errorData?.error?.code;
        
        console.log(`            ❌ API Error: Code ${errorCode} - ${errorMessage}`);
        
        let friendlyMessage = `فشل نشر القصة على Facebook: ${errorMessage}`;
        
        if (errorCode === 1) {
          friendlyMessage = `فشل نشر القصة. الأسباب المحتملة:\n• لم تتم الموافقة على ميزة "Page Stories" في App Review\n• يجب الحصول على إذن pages_manage_posts\n• قد يحتاج التطبيق لتوثيق من Facebook`;
        } else if (errorCode === 190) {
          friendlyMessage = `رمز الوصول منتهي الصلاحية. يرجى إعادة ربط حساب Facebook من إدارة الحسابات.`;
        } else if (errorCode === 10 || errorCode === 200) {
          friendlyMessage = `صلاحيات غير كافية لنشر القصص. تأكد من الحصول على إذن pages_manage_posts.`;
        }
        
        throw new Error(friendlyMessage);
      }

      const result = await response.json();
      console.log(`            ✅ STORY PUBLISHED SUCCESSFULLY (Method 2)!`);
      console.log(`            Response: ${JSON.stringify(result)}`);
      return result;
    }
  }

  async publishVideoStory(pageId: string, accessToken: string, videoUrl: string) {
    console.log(`\n         🎬 === FACEBOOK VIDEO STORY ===`);
    console.log(`            Page ID: ${pageId}`);
    console.log(`            Video URL: ${videoUrl.substring(0, 80)}...`);
    console.log(`            Duration: 20 seconds`);
    
    const url = `${FACEBOOK_BASE_URL}/${pageId}/video_stories`;
    console.log(`            API Endpoint: ${url}`);
    
    const requestBody = {
      video_url: videoUrl,
      duration: 20,
      upload_phase: 'start',
      access_token: accessToken,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`            HTTP Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`            ❌ API Error: ${errorText}`);
      throw new Error(`Failed to publish video story: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`            ✅ VIDEO STORY PUBLISHED SUCCESSFULLY!`);
    console.log(`            Response: ${JSON.stringify(result)}`);
    return result;
  }

  async publishStory(pageId: string, accessToken: string, storyData: FacebookStory) {
    if (storyData.photo_url) {
      return await this.publishPhotoStory(pageId, accessToken, storyData.photo_url);
    } else if (storyData.video_url) {
      return await this.publishVideoStory(pageId, accessToken, storyData.video_url);
    }
    throw new Error('يجب توفير رابط صورة أو فيديو للنشر كـ Story على Facebook');
  }

  async getPageFeed(pageId: string, accessToken: string, limit: number = 25) {
    const url = `${FACEBOOK_BASE_URL}/${pageId}/feed`;
    const params = new URLSearchParams({
      fields: 'id,message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)',
      limit: limit.toString(),
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get page feed: ${response.statusText}`);
    }

    return await response.json();
  }

  async verifyAccessToken(accessToken: string): Promise<{ is_valid: boolean; user_id?: string; expires_at?: number }> {
    if (!this.appId || !this.appSecret) {
      await this.initialize();
    }

    try {
      const appToken = await this.getAppAccessToken();
      const url = `${FACEBOOK_BASE_URL}/debug_token`;
      const params = new URLSearchParams({
        input_token: accessToken,
        access_token: appToken,
      });

      const response = await fetch(`${url}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to verify access token: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('Error verifying Facebook token:', error.message);
      return { is_valid: false };
    }
  }

  async refreshToken(accessToken: string): Promise<string | null> {
    try {
      const result = await this.getLongLivedToken(accessToken);
      return result.access_token;
    } catch (error: any) {
      console.error('Error refreshing Facebook token:', error.message);
      return null;
    }
  }
}

export const facebookSDK = new FacebookSDK();
