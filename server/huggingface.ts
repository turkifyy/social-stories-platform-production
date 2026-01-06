import { HfInference } from '@huggingface/inference';
import { firestoreService } from './firestore';

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';

export class HuggingFaceSDK {
  private apiKey: string | null = null;
  private client: HfInference | null = null;

  async initialize() {
    const config = await firestoreService.getAPIConfig('huggingface');
    this.apiKey = config?.apiKey || process.env.HUGGINGFACE_API_KEY || null;
    
    if (this.apiKey) {
      this.client = new HfInference(this.apiKey);
    }
  }

  private async ensureInitialized() {
    if (!this.apiKey) {
      await this.initialize();
    }
  }

  async generateImage(prompt: string): Promise<{ imageData: string; mimeType: string }> {
    await this.ensureInitialized();

    if (!this.apiKey || !this.client) {
      throw new Error('مفتاح Hugging Face API غير مُعد. يرجى إضافته في لوحة الإدارة.');
    }

    try {
      const imageBlob = await this.client.textToImage({
        model: DEFAULT_MODEL,
        inputs: prompt,
      }) as unknown as Blob;

      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');

      return {
        imageData: base64Image,
        mimeType: 'image/png',
      };
    } catch (error: any) {
      let errorMessage = 'خطأ في توليد الصورة';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.status === 503) {
        errorMessage = 'النموذج قيد التحميل، يرجى المحاولة مرة أخرى بعد قليل';
      } else if (error.status === 401) {
        errorMessage = 'مفتاح Hugging Face API غير صالح';
      }
      
      console.error('Hugging Face API error:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = new HfInference(apiKey);
      
      await client.textToImage({
        model: DEFAULT_MODEL,
        inputs: 'test',
      });

      return true;
    } catch (error: any) {
      if (error.status === 503) {
        return true;
      }
      console.error('Hugging Face API verification error:', error);
      return false;
    }
  }
}

export const huggingFaceSDK = new HuggingFaceSDK();
