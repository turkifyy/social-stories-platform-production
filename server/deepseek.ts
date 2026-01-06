import type { ContentGeneratorRequest, ContentGeneratorResponse } from '@shared/schema';
import { firestoreService } from './firestore';

const DEEPSEEK_API_URL = 'https://api.deepseek.com';
const DEEPSEEK_API_VERSION = 'v1';

type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: DeepSeekModel;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const categoryPrompts: Record<string, string> = {
  movies: `أنشئ محتوى جذاب عن الأفلام والسينما. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. استخدم لغة شيقة ومحفزة للتفاعل.`,
  tv_shows: `أنشئ محتوى مثير عن المسلسلات التلفزيونية. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. استخدم أسلوباً مشوقاً يثير الفضول.`,
  sports: `أنشئ محتوى رياضي محمس. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. استخدم لغة حماسية وملهمة.`,
  recipes: `أنشئ محتوى لذيذ عن وصفات الطبخ. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. اجعله شهياً ومغرياً.`,
  gaming: `أنشئ محتوى مثير عن ألعاب الفيديو. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. استخدم لغة تقنية وممتعة.`,
  apps: `أنشئ محتوى تقني عن التطبيقات والبرمجيات. يجب أن يكون المحتوى قصيراً (100-150 كلمة) ومناسباً للنشر على وسائل التواصل الاجتماعي. ركز على الفوائد والمميزات.`,
};

export class DeepSeekSDK {
  private apiKey: string = '';
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;
    
    const config = await firestoreService.getAPIConfig('deepseek');
    if (config && config.apiKey) {
      this.apiKey = config.apiKey;
      this.initialized = true;
    } else if (process.env.DEEPSEEK_API_KEY) {
      this.apiKey = process.env.DEEPSEEK_API_KEY;
      this.initialized = true;
    }
  }

  async chat(messages: DeepSeekMessage[], model: DeepSeekModel = 'deepseek-chat', options?: Partial<DeepSeekRequest>): Promise<DeepSeekResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error('DeepSeek API key is not configured. Please add it in the admin panel or environment variables.');
    }

    const url = `${DEEPSEEK_API_URL}/${DEEPSEEK_API_VERSION}/chat/completions`;

    const requestBody: DeepSeekRequest = {
      model,
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.max_tokens ?? 500,
      ...options,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    return await response.json();
  }

  async generateWithReasoning(prompt: string, systemPrompt?: string): Promise<{ content: string; reasoning?: string }> {
    const messages: DeepSeekMessage[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];

    const response = await this.chat(messages, 'deepseek-reasoner');
    
    return {
      content: response.choices[0]?.message?.content || '',
      reasoning: response.choices[0]?.message?.reasoning_content,
    };
  }

  async generateSimple(prompt: string, systemPrompt?: string, options?: Partial<DeepSeekRequest>): Promise<string> {
    const messages: DeepSeekMessage[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];

    const response = await this.chat(messages, 'deepseek-chat', options);
    
    return response.choices[0]?.message?.content || '';
  }

  async streamChat(messages: DeepSeekMessage[], model: DeepSeekModel = 'deepseek-chat', options?: Partial<DeepSeekRequest>): Promise<ReadableStream> {
    if (!this.apiKey) {
      await this.initialize();
    }

    const url = `${DEEPSEEK_API_URL}/${DEEPSEEK_API_VERSION}/chat/completions`;

    const requestBody: DeepSeekRequest = {
      model,
      messages,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.max_tokens ?? 500,
      stream: true,
      ...options,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    return response.body!;
  }

  async verifyApiKey(): Promise<boolean> {
    try {
      await this.generateSimple('Test', 'You are a helpful assistant', { max_tokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const deepseekSDK = new DeepSeekSDK();

export async function generateContent(request: ContentGeneratorRequest): Promise<ContentGeneratorResponse> {
  const basePrompt = categoryPrompts[request.category] || categoryPrompts.movies;
  const keywordsPrompt = request.keywords
    ? `\n\nاستخدم هذه الكلمات المفتاحية في المحتوى: ${request.keywords}`
    : '';

  const fullPrompt = `${basePrompt}${keywordsPrompt}\n\nتذكر: المحتوى يجب أن يكون باللغة العربية، جذاب، ومناسب للنشر على فيسبوك وانستجرام وتيك توك.`;

  try {
    const content = await deepseekSDK.generateSimple(
      fullPrompt,
      'أنت مساعد ذكي متخصص في إنشاء محتوى إبداعي لوسائل التواصل الاجتماعي باللغة العربية.',
      {
        temperature: 0.8,
        max_tokens: 500,
      }
    );

    return {
      content: content.trim(),
      category: request.category,
    };
  } catch (error) {
    console.error('DeepSeek generation error:', error);
    throw new Error('فشل في إنشاء المحتوى باستخدام الذكاء الاصطناعي');
  }
}

export async function translateToArabic(text: string): Promise<string> {
  if (!text || text.length < 5) {
    return text;
  }

  const systemPrompt = 'أنت مترجم محترف متخصص في الترجمة من الإنجليزية إلى العربية. ترجم النص بأسلوب إبداعي وجذاب مناسب لوسائل التواصل الاجتماعي. حافظ على المعنى الأصلي مع جعل النص تشويقياً ومثيراً.';
  const userPrompt = `ترجم هذا النص إلى العربية بأسلوب تشويقي وجذاب:\n\n"${text}"\n\nأعطني الترجمة العربية فقط بدون أي شرح أو إضافات.`;

  try {
    const translation = await deepseekSDK.generateSimple(
      userPrompt,
      systemPrompt,
      {
        temperature: 0.5,
        max_tokens: 300,
      }
    );

    const cleanedTranslation = translation.trim().replace(/^["']|["']$/g, '');
    console.log(`🌐 AI Translated to Arabic: "${cleanedTranslation.substring(0, 50)}..."`);
    return cleanedTranslation;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

export async function generatePromotionalDescription(
  title: string,
  category: string,
  originalDescription?: string
): Promise<{ descriptionAr: string; descriptionEn: string }> {
  const categoryPromptMap: Record<string, { ar: string; en: string }> = {
    movies: {
      ar: `اكتب وصفاً تشويقياً احترافياً (3-4 جمل، حوالي 100-120 كلمة) لفيلم "${title}" لوسائل التواصل الاجتماعي. اجعله مثيراً وجذاباً ويحفز المشاهدين على مشاهدة الفيلم فوراً. استخدم لغة قوية وعاطفية.`,
      en: `Write a professional promotional description (3-4 sentences, about 100-120 words) for the movie "${title}" for social media. Make it exciting and compelling to encourage viewers to watch immediately. Use powerful, engaging language.`,
    },
    tv_shows: {
      ar: `اكتب وصفاً تشويقياً احترافياً (3-4 جمل، حوالي 100-120 كلمة) لمسلسل "${title}" لوسائل التواصل الاجتماعي. اجعله مثيراً ويحفز المشاهدين على متابعة المسلسل من أول حلقة.`,
      en: `Write a professional promotional description (3-4 sentences, about 100-120 words) for the TV series "${title}" for social media. Make it exciting to encourage viewers to follow from episode one.`,
    },
    sports: {
      ar: `اكتب وصفاً حماسياً احترافياً (3-4 جمل، حوالي 100-120 كلمة) عن "${title}" في الرياضة. اجعله مثيراً ويحفز المتابعين على عدم تفويت هذا الحدث.`,
      en: `Write a professional exciting description (3-4 sentences, about 100-120 words) about "${title}" in sports. Make it thrilling to encourage fans not to miss this event.`,
    },
    recipes: {
      ar: `اكتب وصفاً شهياً احترافياً (3-4 جمل، حوالي 100-120 كلمة) لوصفة "${title}". اجعله يثير الشهية بشدة ويحفز على تجربة الوصفة فوراً. اذكر فوائد ومميزات الطبق.`,
      en: `Write a professional appetizing description (3-4 sentences, about 100-120 words) for the recipe "${title}". Make it extremely mouth-watering and encourage trying the recipe immediately.`,
    },
    gaming: {
      ar: `اكتب وصفاً مثيراً احترافياً (3-4 جمل، حوالي 100-120 كلمة) للعبة "${title}". اجعله يحفز اللاعبين على تحميل وتجربة اللعبة فوراً. اذكر مميزات اللعبة.`,
      en: `Write a professional exciting description (3-4 sentences, about 100-120 words) for the game "${title}". Make it thrilling for gamers to download and try immediately.`,
    },
    apps: {
      ar: `اكتب وصفاً جذاباً احترافياً (3-4 جمل، حوالي 100-120 كلمة) لتطبيق "${title}". اجعله يبرز فوائد ومميزات التطبيق بطريقة مقنعة تحفز على التحميل.`,
      en: `Write a professional attractive description (3-4 sentences, about 100-120 words) for the app "${title}". Highlight its benefits and features in a compelling way that encourages download.`,
    },
  };

  const prompts = categoryPromptMap[category] || categoryPromptMap.movies;

  try {
    const contextInfo = originalDescription 
      ? `\n\nمعلومات إضافية: ${originalDescription.substring(0, 300)}`
      : '';

    const [arResult, enResult] = await Promise.all([
      deepseekSDK.generateSimple(
        prompts.ar + contextInfo,
        'أنت كاتب محتوى إبداعي محترف متخصص في وسائل التواصل الاجتماعي. اكتب بأسلوب جذاب ومقنع. اجعل المحتوى قوياً عاطفياً ويحفز على التفاعل.',
        { temperature: 0.75, max_tokens: 250 }
      ),
      deepseekSDK.generateSimple(
        prompts.en + (originalDescription ? `\n\nContext: ${originalDescription.substring(0, 300)}` : ''),
        'You are a professional creative content writer for social media. Write in an engaging and compelling style. Make content emotionally powerful and encourage engagement.',
        { temperature: 0.75, max_tokens: 250 }
      ),
    ]);

    return {
      descriptionAr: arResult.trim().replace(/^["']|["']$/g, ''),
      descriptionEn: enResult.trim().replace(/^["']|["']$/g, ''),
    };
  } catch (error) {
    console.error('Promotional description generation error:', error);
    return {
      descriptionAr: `${title} - محتوى رائع ومميز يستحق المتابعة والتجربة! لا تفوت هذه الفرصة الاستثنائية`,
      descriptionEn: `${title} - Amazing and unique content worth following and trying! Don't miss this exceptional opportunity`,
    };
  }
}

export async function generateImagePrompt(category: string, content: string): Promise<string> {
  const categoryImageStyles: Record<string, string> = {
    movies: 'cinematic movie poster, dramatic lighting, 4K ultra HD, professional photography, film grain, movie theater quality',
    tv_shows: 'TV series poster style, vibrant colors, modern design, Netflix quality, dramatic composition, 8K resolution',
    sports: 'dynamic sports action shot, energetic composition, professional sports photography, stadium lights, high-speed capture, 4K',
    recipes: 'professional food photography, appetizing presentation, warm natural lighting, cookbook quality, macro detail, delicious colors',
    gaming: 'AAA video game concept art, digital illustration, vibrant neon colors, RTX quality, professional game poster, 4K',
    apps: 'modern app interface showcase, clean minimal design, tech aesthetic, Apple quality, premium device mockup, glossy finish'
  };

  const styleGuide = categoryImageStyles[category] || 'professional, high quality, 4K resolution';
  
  const systemPrompt = 'You are an expert at creating prompts for FLUX AI image generation. Generate detailed, visual prompts that produce stunning HD images. Focus on composition, lighting, colors, and atmosphere.';
  const userPrompt = `Create an image prompt for: "${content}"
Style guidelines: ${styleGuide}

Requirements:
- Make it visual and descriptive
- Include lighting and mood
- Specify quality (4K, HD, professional)
- Keep it under 50 words
- English only, no explanations

Generate the prompt:`;

  try {
    const prompt = await deepseekSDK.generateSimple(
      userPrompt,
      systemPrompt,
      {
        temperature: 0.8,
        max_tokens: 120,
      }
    );

    const cleanedPrompt = prompt.trim().replace(/^["']|["']$/g, '');
    console.log(`🎨 Generated HD image prompt: "${cleanedPrompt.substring(0, 80)}..."`);
    return cleanedPrompt;
  } catch (error) {
    console.error('Image prompt generation error:', error);
    return `${content}, ${styleGuide}, professional quality`;
  }
}

export async function generateHDPosterPrompt(
  title: string,
  category: string,
  additionalContext?: string
): Promise<string> {
  const categoryStyles: Record<string, string> = {
    movies: 'dramatic cinematic movie poster, epic composition, theatrical release quality, IMAX style, film poster art',
    tv_shows: 'streaming service quality poster, binge-worthy series art, Netflix/HBO style, dramatic character composition',
    sports: 'action sports photography, stadium atmosphere, championship moment, ESPN broadcast quality',
    recipes: 'gourmet food photography, Michelin star presentation, food magazine cover, appetizing closeup',
    gaming: 'AAA game cover art, PlayStation/Xbox quality, epic gaming poster, concept art masterpiece',
    apps: 'App Store featured banner, premium app showcase, modern UI design, Apple design award quality',
    tv_channels: 'professional TV channel branding, broadcast quality logo, modern media design, entertainment network style'
  };

  const style = categoryStyles[category] || categoryStyles.movies;
  
  const prompt = `${title}, ${style}, ultra high definition 4K, professional lighting, stunning composition, ${additionalContext || 'trending content'}`;
  
  return prompt;
}

export interface PosterContent {
  descriptionAr: string;
  descriptionEn: string;
  ctaAr: string;
  ctaEn: string;
}

export async function generatePosterContent(
  title: string,
  category: string,
  originalDescription?: string
): Promise<PosterContent> {
  const categoryPromptMap: Record<string, { ar: string; en: string; ctaAr: string; ctaEn: string }> = {
    movies: {
      ar: `اكتب وصفاً تشويقياً احترافياً مكوناً من 4 جمل قوية ومثيرة (حوالي 140-160 كلمة) لفيلم "${title}" لوسائل التواصل الاجتماعي. اجعله مثيراً للغاية وجذاباً ويحفز المشاهدين على مشاهدة الفيلم فوراً. استخدم لغة قوية وعاطفية ومؤثرة. يجب أن يكون الوصف شاملاً ومكتملاً في 4 جمل كاملة.`,
      en: `Write a professional promotional description with exactly 4 powerful and exciting sentences (about 140-160 words) for the movie "${title}" for social media. Make it extremely exciting and compelling to encourage viewers to watch immediately. Use powerful, engaging, and emotional language. The description must be complete in 4 full sentences.`,
      ctaAr: 'شاهد الفيلم الآن مجاناً',
      ctaEn: 'WATCH NOW FOR FREE'
    },
    tv_shows: {
      ar: `اكتب وصفاً تشويقياً احترافياً مكوناً من 4 جمل مثيرة (حوالي 140-160 كلمة) لمسلسل "${title}" لوسائل التواصل الاجتماعي. اجعله مثيراً للفضول ويحفز المشاهدين على متابعة المسلسل من أول حلقة. استخدم لغة تشويقية قوية تجعل القارئ يشتاق لمشاهدته. يجب أن يكون الوصف كاملاً في 4 جمل.`,
      en: `Write a professional promotional description with exactly 4 exciting sentences (about 140-160 words) for the TV series "${title}" for social media. Make it intriguing and encourage viewers to follow from episode one. Use powerful suspenseful language. The description must be complete in 4 sentences.`,
      ctaAr: 'تابع المسلسل الآن',
      ctaEn: 'WATCH THE SERIES NOW'
    },
    sports: {
      ar: `اكتب وصفاً حماسياً احترافياً مكوناً من 4 جمل قوية (حوالي 140-160 كلمة) عن "${title}" في الرياضة. اجعله مثيراً للحماس ويحفز المتابعين على عدم تفويت هذا الحدث الرياضي المهم. استخدم لغة حماسية وملهبة للمشاعر. يجب أن يكون الوصف مكتملاً في 4 جمل.`,
      en: `Write a professional exciting description with exactly 4 powerful sentences (about 140-160 words) about "${title}" in sports. Make it thrilling and encourage fans not to miss this important event. Use enthusiastic and passionate language. The description must be complete in 4 sentences.`,
      ctaAr: 'شاهد المباراة مباشرة الآن',
      ctaEn: 'WATCH LIVE NOW'
    },
    recipes: {
      ar: `اكتب وصفاً شهياً واحترافياً مكوناً من 4 جمل مغرية (حوالي 140-160 كلمة) لوصفة "${title}". اجعله يثير الشهية بشدة ويحفز على تجربة الوصفة فوراً. اذكر المذاق الرائع والفوائد الصحية ومميزات الطبق. استخدم لغة تجعل القارئ يشعر بالجوع. يجب أن يكون الوصف كاملاً في 4 جمل.`,
      en: `Write a professional appetizing description with exactly 4 tempting sentences (about 140-160 words) for the recipe "${title}". Make it extremely mouth-watering and encourage trying the recipe immediately. Mention the amazing taste, health benefits, and dish features. The description must be complete in 4 sentences.`,
      ctaAr: 'اكتشف الوصفة السرية الكاملة',
      ctaEn: 'DISCOVER THE FULL SECRET RECIPE'
    },
    gaming: {
      ar: `اكتب وصفاً مثيراً واحترافياً مكوناً من 4 جمل قوية (حوالي 140-160 كلمة) للعبة "${title}" الترند. اجعله يحفز اللاعبين على تحميل وتجربة اللعبة فوراً. اذكر الرسومات الخرافية والأسلوب المبتكر والتحديات المثيرة. استخدم لغة الجيمرز الحماسية. يجب أن يكون الوصف مكتملاً في 4 جمل.`,
      en: `Write a professional exciting description with exactly 4 powerful sentences (about 140-160 words) for the trending game "${title}". Make it thrilling for gamers to download and try immediately. Mention stunning graphics, innovative gameplay, and exciting challenges. The description must be complete in 4 sentences.`,
      ctaAr: 'حمّل اللعبة مجاناً الآن',
      ctaEn: 'DOWNLOAD FREE NOW'
    },
    apps: {
      ar: `اكتب وصفاً جذاباً واحترافياً مكوناً من 4 جمل مقنعة (حوالي 140-160 كلمة) لتطبيق "${title}" الترند. اجعله يبرز الفوائد العظيمة ومميزات التطبيق بطريقة مقنعة تحفز على التحميل فوراً. اذكر كيف سيغير حياة المستخدم للأفضل. يجب أن يكون الوصف مكتملاً في 4 جمل.`,
      en: `Write a professional attractive description with exactly 4 compelling sentences (about 140-160 words) for the trending app "${title}". Highlight its amazing benefits and features in a way that encourages immediate download. Mention how it will change the user's life for the better. The description must be complete in 4 sentences.`,
      ctaAr: 'احصل على النسخة المدفوعة مجاناً',
      ctaEn: 'GET PREMIUM VERSION FREE'
    },
    tv_channels: {
      ar: `اكتب وصفاً احترافياً مكوناً من 4 جمل مثيرة (حوالي 140-160 كلمة) لقناة "${title}" التلفزيونية الترند. اجعله يحفز المشاهدين على متابعة القناة والاستمتاع ببرامجها المميزة. اذكر البرامج الحصرية والمحتوى الفريد. يجب أن يكون الوصف مكتملاً في 4 جمل.`,
      en: `Write a professional description with exactly 4 exciting sentences (about 140-160 words) for the trending TV channel "${title}". Make it encourage viewers to follow the channel and enjoy its unique programs. Mention exclusive shows and unique content. The description must be complete in 4 sentences.`,
      ctaAr: 'شاهد البث المباشر الآن',
      ctaEn: 'WATCH LIVE BROADCAST NOW'
    }
  };

  const prompts = categoryPromptMap[category] || categoryPromptMap.movies;

  try {
    const contextInfo = originalDescription 
      ? `\n\nمعلومات إضافية عن المحتوى: ${originalDescription.substring(0, 400)}`
      : '';

    const [arResult, enResult] = await Promise.all([
      deepseekSDK.generateSimple(
        prompts.ar + contextInfo + '\n\nهام جداً: اكتب الوصف التشويقي فقط بدون أي مقدمات أو عناوين. يجب أن يكون 4 جمل كاملة.',
        'أنت كاتب محتوى إبداعي محترف متخصص في وسائل التواصل الاجتماعي. اكتب بأسلوب جذاب ومقنع وتشويقي. اجعل المحتوى قوياً عاطفياً ويحفز على التفاعل الفوري. لا تكتب أي مقدمات، فقط الوصف التشويقي المكون من 4 جمل.',
        { temperature: 0.75, max_tokens: 350 }
      ),
      deepseekSDK.generateSimple(
        prompts.en + (originalDescription ? `\n\nAdditional context: ${originalDescription.substring(0, 400)}` : '') + '\n\nIMPORTANT: Write ONLY the promotional description without any introductions or titles. It must be exactly 4 complete sentences.',
        'You are a professional creative content writer for social media. Write in an engaging, compelling, and suspenseful style. Make content emotionally powerful and encourage immediate engagement. Do not write any introductions, just the 4-sentence promotional description.',
        { temperature: 0.75, max_tokens: 350 }
      ),
    ]);

    return {
      descriptionAr: arResult.trim().replace(/^["']|["']$/g, '').replace(/^\*\*.*?\*\*\n?/g, ''),
      descriptionEn: enResult.trim().replace(/^["']|["']$/g, '').replace(/^\*\*.*?\*\*\n?/g, ''),
      ctaAr: prompts.ctaAr,
      ctaEn: prompts.ctaEn,
    };
  } catch (error) {
    console.error('Poster content generation error:', error);
    return {
      descriptionAr: getDefaultDescription(category, title, 'ar'),
      descriptionEn: getDefaultDescription(category, title, 'en'),
      ctaAr: prompts.ctaAr,
      ctaEn: prompts.ctaEn,
    };
  }
}

function getDefaultDescription(category: string, title: string, lang: 'ar' | 'en'): string {
  const defaults: Record<string, { ar: string; en: string }> = {
    movies: {
      ar: `فيلم ${title} الجديد يحطم كل التوقعات بقصته المذهلة وأداء الممثلين الاستثنائي! رحلة سينمائية لن تنساها أبداً مليئة بالتشويق والإثارة. انضم لملايين المشاهدين الذين أحبوا هذا العمل الفني الرائع. لا تفوت فرصة مشاهدة أفضل فيلم في هذا الموسم!`,
      en: `${title} shatters all expectations with its amazing story and exceptional performances! A cinematic journey you'll never forget, filled with suspense and excitement. Join millions of viewers who loved this masterpiece. Don't miss your chance to watch the best movie of the season!`
    },
    tv_shows: {
      ar: `مسلسل ${title} الترند يأسرك من الحلقة الأولى بأحداثه المثيرة ونهاياته الصادمة! شخصيات لا تُنسى وقصة تجعلك تنتظر كل حلقة بفارغ الصبر. انضم لملايين المتابعين في هذه الرحلة الاستثنائية. أفضل مسلسل يمكنك مشاهدته الآن!`,
      en: `${title} captivates you from episode one with thrilling events and shocking endings! Unforgettable characters and a story that makes you eagerly await each episode. Join millions of followers on this extraordinary journey. The best series you can watch right now!`
    },
    recipes: {
      ar: `وصفة ${title} الشهية ستجعل عائلتك تطلبها مراراً وتكراراً! مكونات بسيطة ونتيجة مذهلة تفوق كل التوقعات. طعم لذيذ ورائحة تملأ المكان بالشهية والسعادة. جربها الآن واكتشف سر الطبق الذي يحبه الجميع!`,
      en: `The delicious ${title} recipe will make your family ask for it again and again! Simple ingredients with amazing results that exceed all expectations. Delicious taste and aroma that fills the place with appetite and happiness. Try it now and discover the secret everyone loves!`
    },
    gaming: {
      ar: `لعبة ${title} الأسطورية ستأسرك من اللحظة الأولى برسوماتها الخيالية! عالم ضخم من الإثارة والتحديات المثيرة ينتظرك الآن. انضم لملايين اللاعبين حول العالم في هذه المغامرة الملحمية. حمّل اللعبة مجاناً وابدأ رحلتك نحو القمة!`,
      en: `The legendary game ${title} will captivate you from the first moment with stunning graphics! A massive world of excitement and thrilling challenges awaits you now. Join millions of players worldwide in this epic adventure. Download free and start your journey to the top!`
    },
    apps: {
      ar: `تطبيق ${title} المميز سيغير طريقة حياتك للأفضل بشكل لا يصدق! ملايين المستخدمين يثقون به ويعتمدون عليه يومياً في مهامهم. تصميم مذهل وميزات احترافية لن تجدها في أي مكان آخر. احصل على النسخة المدفوعة مجاناً لفترة محدودة جداً!`,
      en: `The amazing ${title} app will change your life for the better incredibly! Millions of users trust and rely on it daily for their tasks. Stunning design and professional features you won't find anywhere else. Get the premium version free for a very limited time!`
    },
    tv_channels: {
      ar: `قناة ${title} الترند تقدم أفضل المحتوى الحصري والبرامج المميزة! بث مباشر على مدار الساعة بجودة فائقة ومحتوى متنوع يناسب الجميع. انضم لملايين المشاهدين الذين يستمتعون بهذه القناة الرائعة. شاهد البث المباشر الآن واستمتع بتجربة فريدة!`,
      en: `${title} channel offers the best exclusive content and amazing programs! 24/7 live broadcast in superior quality with diverse content for everyone. Join millions of viewers enjoying this amazing channel. Watch the live broadcast now and enjoy a unique experience!`
    }
  };

  const defaultContent = defaults[category] || defaults.movies;
  return lang === 'ar' ? defaultContent.ar : defaultContent.en;
}

export async function generateCategoryImagePrompt(
  title: string,
  category: string,
  includeLogoStyle: boolean = false
): Promise<string> {
  const categoryStyles: Record<string, { style: string; logoStyle?: string }> = {
    movies: {
      style: 'dramatic cinematic movie poster, epic composition, theatrical release quality, IMAX style, film poster art, Hollywood blockbuster aesthetic, dramatic lighting, 8K ultra HD',
      logoStyle: 'movie title typography, cinematic logo design'
    },
    tv_shows: {
      style: 'streaming service quality poster, binge-worthy series art, Netflix/HBO style, dramatic character composition, TV series promotional art, premium streaming quality, 8K resolution',
      logoStyle: 'TV series logo, streaming service branding'
    },
    sports: {
      style: 'action sports photography, stadium atmosphere, championship moment, ESPN broadcast quality, dynamic motion blur, professional sports photography, 4K HDR',
      logoStyle: 'sports team logo, championship branding'
    },
    recipes: {
      style: 'professional gourmet food photography, Michelin star presentation, food magazine cover quality, appetizing macro closeup, warm natural lighting, delicious colors, cookbook photography, 8K',
      logoStyle: 'food brand logo, restaurant quality presentation'
    },
    gaming: {
      style: 'AAA video game cover art, PlayStation/Xbox quality, epic gaming poster, concept art masterpiece, vibrant neon colors, RTX ray tracing quality, game box art, 8K ultra HD',
      logoStyle: 'video game logo, gaming brand typography, neon glow effect'
    },
    apps: {
      style: 'App Store featured banner, premium app showcase, modern UI design, Apple design award quality, clean minimal interface, tech aesthetic, smartphone mockup, glossy finish, 8K',
      logoStyle: 'app icon design, modern app logo, iOS/Android style'
    },
    tv_channels: {
      style: 'professional TV channel branding, broadcast quality design, modern media network aesthetic, entertainment channel logo, premium broadcast graphics, 8K resolution',
      logoStyle: 'TV channel logo, broadcast network branding'
    }
  };

  const categoryConfig = categoryStyles[category] || categoryStyles.movies;
  
  const systemPrompt = `You are an expert at creating prompts for FLUX AI image generation. Generate detailed, visual prompts that produce stunning HD professional poster images. Focus on composition, lighting, colors, atmosphere, and quality. The image should look like a professional ${category} promotional poster.`;
  
  const userPrompt = `Create a detailed image generation prompt for a professional ${category} poster featuring "${title}".

Style requirements:
${categoryConfig.style}
${includeLogoStyle ? categoryConfig.logoStyle : ''}

Additional requirements:
- Professional studio quality lighting
- Ultra high definition 8K resolution
- Stunning composition suitable for social media stories (9:16 aspect ratio)
- Vibrant, eye-catching colors
- Modern, trendy aesthetic
- The image should prominently feature the subject "${title}"

Generate the prompt in English only, under 80 words, no explanations:`;

  try {
    const prompt = await deepseekSDK.generateSimple(
      userPrompt,
      systemPrompt,
      { temperature: 0.8, max_tokens: 150 }
    );

    const cleanedPrompt = prompt.trim().replace(/^["']|["']$/g, '');
    console.log(`🎨 Generated category-specific HD image prompt for ${category}: "${cleanedPrompt.substring(0, 100)}..."`);
    return cleanedPrompt;
  } catch (error) {
    console.error('Category image prompt generation error:', error);
    return `${title}, ${categoryConfig.style}, professional quality, 8K ultra HD, stunning composition`;
  }
}
