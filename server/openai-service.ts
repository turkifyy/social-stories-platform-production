import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const categoryPrompts: Record<string, string> = {
  movies: "أفلام ومراجعات سينمائية",
  tv_shows: "مسلسلات تلفزيونية وعروض",
  sports: "رياضة وأحداث رياضية",
  recipes: "وصفات طبخ وأكلات",
  gaming: "ألعاب فيديو وألعاب إلكترونية",
  apps: "تطبيقات وتقنية",
};

export async function generateContent(
  category: string,
  keywords?: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to environment variables.');
  }

  const categoryName = categoryPrompts[category] || category;
  
  const prompt = `اكتب منشور قصير جذاب ومثير للاهتمام لقصة على وسائل التواصل الاجتماعي عن ${categoryName}${keywords ? ` متعلق بـ: ${keywords}` : ''}

المتطلبات:
- استخدم اللغة العربية بشكل كامل
- اجعل المحتوى قصيراً (100-200 كلمة)
- استخدم أسلوباً جذاباً ومشوقاً ومحترفاً
- لا تستخدم الإيموجي أبداً
- اجعله مناسباً للنشر على فيسبوك وانستجرام وتيك توك
- استخدم علامات ترقيم وأسلوب كتابة احترافي`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "أنت كاتب محتوى محترف متخصص في كتابة منشورات وسائل التواصل الاجتماعي باللغة العربية. تكتب محتوى جذاباً ومثيراً للاهتمام بدون استخدام الإيموجي.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || "عذراً، لم نتمكن من إنشاء المحتوى. حاول مرة أخرى.";
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    throw new Error("فشل في إنشاء المحتوى. تأكد من صحة مفتاح API الخاص بك.");
  }
}

/**
 * Generate trending hashtags based on story content
 */
export async function generateHashtags(content: string, category: string): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [`#${category}`, '#ترند', '#اكسبلور'];
  }

  try {
    const prompt = `بناءً على المحتوى التالي لقصة على وسائل التواصل الاجتماعي، اقترح 10 هاشتاجات (وسوم) شائعة ومناسبة باللغة العربية والإنجليزية.
محتوى القصة: "${content}"
الفئة: "${category}"

قم بإرجاع الهاشتاجات فقط مفصولة بمسافات، بدون أي نص إضافي أو ترقيم.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const hashtagsText = response.choices[0].message.content || "";
    // Extract hashtags starting with #
    const hashtags = hashtagsText.match(/#[\w\u0600-\u06FF]+/g) || [];
    
    // Fallback if no hashtags found
    if (hashtags.length === 0) {
      return [`#${category}`, '#ترند', '#اكسبلور'];
    }

    return Array.from(new Set(hashtags)).slice(0, 10);
  } catch (error) {
    console.error("Error generating hashtags:", error);
    return [`#${category}`, '#ترند', '#اكسبلور'];
  }
}
