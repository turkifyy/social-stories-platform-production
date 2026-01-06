import { firestoreService } from "./firestore";
import type { Story } from "@shared/schema";

export class FacebookStoriesPublisher {
  async publishStoryToFacebook(story: Story, accountId: string): Promise<{
    success: boolean;
    publishedId?: string;
    error?: string;
  }> {
    try {
      const account = await firestoreService.getLinkedAccountById(accountId);
      
      if (!account || account.platform !== 'facebook') {
        return {
          success: false,
          error: 'Invalid Facebook account'
        };
      }

      if (account.status !== 'active') {
        return {
          success: false,
          error: 'Account is not active'
        };
      }

      if (!account.capabilities.canPublishStories) {
        return {
          success: false,
          error: 'Account cannot publish stories'
        };
      }

      // Get the appropriate image URL for Facebook Stories
      let imageUrl = story.facebookPngUrl || story.jpegUrl || story.mediaUrl;
      
      if (!imageUrl) {
        return {
          success: false,
          error: 'No image URL available for story'
        };
      }

      console.log(`📱 Publishing story ${story.id} to Facebook Stories...`);

      // Make API call to Facebook Stories API
      const response = await this.callFacebookStoriesAPI(
        account.externalId,
        account.accessToken,
        {
          image_url: imageUrl,
          content: story.content,
          link: `https://yourapp.com/stories/${story.id}`,
          video_url: story.videoUrl,
        }
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to publish to Facebook Stories'
        };
      }

      console.log(`✅ Successfully published story ${story.id} to Facebook Stories (ID: ${response.publishedId})`);

      return {
        success: true,
        publishedId: response.publishedId
      };
    } catch (error: any) {
      console.error(`❌ Error publishing to Facebook Stories:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async callFacebookStoriesAPI(
    pageId: string,
    accessToken: string,
    data: {
      image_url: string;
      content: string;
      link: string;
      video_url?: string;
    }
  ): Promise<{ success: boolean; publishedId?: string; error?: string }> {
    try {
      const url = `https://graph.facebook.com/v18.0/${pageId}/stories`;
      
      const payload: Record<string, any> = {
        access_token: accessToken,
      };

      // If video URL exists, use video
      if (data.video_url) {
        payload.video_url = data.video_url;
      } else {
        // Otherwise use image
        payload.image_url = data.image_url;
      }

      // Add media source (upload video/image)
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Facebook API error'
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        publishedId: result.id
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const facebookStoriesPublisher = new FacebookStoriesPublisher();
