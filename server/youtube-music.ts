import type { YouTubeMusicSearchResult, YouTubeMusicSearchResponse } from "@shared/schema";

export class YouTubeMusicService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchMusic(query: string, limit: number = 10): Promise<YouTubeMusicSearchResponse> {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' music')}&type=video&videoCategoryId=10&maxResults=${limit}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'فشل البحث عن الموسيقى');
      }

      const data = await response.json();
      
      const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
      
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds}&key=${this.apiKey}`;
      const detailsResponse = await fetch(detailsUrl);
      
      if (!detailsResponse.ok) {
        throw new Error('فشل الحصول على تفاصيل الفيديو');
      }
      
      const detailsData = await detailsResponse.json();
      
      const results: YouTubeMusicSearchResult[] = detailsData.items.map((item: any) => {
        const duration = this.parseDuration(item.contentDetails.duration);
        
        return {
          videoId: item.id,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          duration,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          url: `https://www.youtube.com/watch?v=${item.id}`
        };
      });

      return { results };
    } catch (error: any) {
      console.error('YouTube Music search error:', error);
      throw new Error(error.message || 'فشل البحث عن الموسيقى');
    }
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[YouTube Test] Starting connection test...');
      console.log('[YouTube Test] API Key (masked):', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'not provided');
      
      if (!this.apiKey || this.apiKey.trim() === '') {
        return {
          success: false,
          message: 'مفتاح YouTube API مطلوب'
        };
      }
      
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=${this.apiKey}`;
      const response = await fetch(url);
      
      console.log('[YouTube Test] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = 'فشل الاتصال بـ YouTube API';
        try {
          const errorData = await response.json();
          console.log('[YouTube Test] Error response:', JSON.stringify(errorData, null, 2));
          
          if (response.status === 400) {
            if (errorData.error?.message?.includes('API key not valid')) {
              errorMessage = 'مفتاح YouTube API غير صالح - يرجى التحقق من المفتاح';
            } else if (errorData.error?.message?.includes('quota')) {
              errorMessage = 'تجاوزت حصة YouTube API اليومية - يرجى المحاولة لاحقاً';
            } else {
              errorMessage = `خطأ YouTube API: ${errorData.error?.message || errorData.message || 'غير معروف'}`;
            }
          } else if (response.status === 403) {
            if (errorData.error?.message?.includes('Daily Limit Exceeded')) {
              errorMessage = 'تجاوزت الحد اليومي لاستخدام YouTube API';
            } else if (errorData.error?.message?.includes('not enabled')) {
              errorMessage = 'YouTube Data API v3 غير مفعل في مشروعك - يرجى تفعيله من Google Cloud Console';
            } else {
              errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من إعدادات API في Google Cloud Console';
            }
          } else if (response.status === 404) {
            errorMessage = 'خدمة YouTube API غير متاحة - يرجى المحاولة لاحقاً';
          } else {
            errorMessage = errorData.error?.message || `خطأ YouTube API (رمز ${response.status})`;
          }
        } catch (parseError) {
          console.log('[YouTube Test] Failed to parse error response:', parseError);
          errorMessage = `خطأ YouTube API (رمز ${response.status}): ${response.statusText}`;
        }
        
        console.log('[YouTube Test] Final error message:', errorMessage);
        
        return {
          success: false,
          message: errorMessage
        };
      }
      
      const successData = await response.json();
      console.log('[YouTube Test] Success! Response:', JSON.stringify(successData, null, 2));
      
      return {
        success: true,
        message: 'نجح الاتصال بـ YouTube API - المفتاح صالح ويعمل بشكل صحيح'
      };
    } catch (error: any) {
      console.log('[YouTube Test] Exception:', error);
      return {
        success: false,
        message: `فشل الاتصال بـ YouTube API: ${error.message || 'خطأ في الشبكة'}`
      };
    }
  }
}
