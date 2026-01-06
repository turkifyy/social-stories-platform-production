# دليل SDKs للمنصة - 2025

هذا الدليل يشرح كيفية استخدام أحدث إصدارات SDKs المحدثة لعام 2025 للتكامل مع منصات التواصل الاجتماعي وخدمات الذكاء الاصطناعي.

## Facebook SDK (v22.0)

### الميزات الجديدة
- دعم كامل لـ Facebook Graph API v22.0
- نشر Reels على الصفحات
- إدارة توكنات طويلة الأمد (Long-lived tokens)
- الحصول على صفحات المستخدم
- التحقق من صلاحية التوكنات

### أمثلة الاستخدام

#### نشر منشور على صفحة
```typescript
import { facebookSDK } from './sdk/facebook';

const pageId = 'YOUR_PAGE_ID';
const accessToken = 'USER_ACCESS_TOKEN';

const result = await facebookSDK.publishPost(pageId, accessToken, {
  message: 'محتوى المنشور هنا',
  link: 'https://example.com',
});
```

#### نشر Reel
```typescript
const reel = await facebookSDK.publishReel(pageId, accessToken, {
  video_url: 'https://example.com/video.mp4',
  description: 'وصف الفيديو',
  title: 'عنوان الفيديو',
});
```

#### الحصول على توكن طويل الأمد
```typescript
const longLivedToken = await facebookSDK.getLongLivedToken(shortLivedToken);
console.log('Token expires in:', longLivedToken.expires_in);
```

---

## Instagram SDK (v22.0)

### الميزات الجديدة
- دعم Instagram Graph API v22.0
- نشر Reels والقصص
- إدارة توكنات طويلة الأمد وتحديثها
- البحث في الهاشتاقات
- إحصائيات الحساب المحسنة

### أمثلة الاستخدام

#### نشر صورة
```typescript
import { instagramSDK } from './sdk/instagram';

const igUserId = 'IG_USER_ID';
const accessToken = 'USER_ACCESS_TOKEN';

const result = await instagramSDK.publishPost(igUserId, accessToken, {
  image_url: 'https://example.com/image.jpg',
  caption: 'نص المنشور',
});
```

#### نشر Reel
```typescript
const reel = await instagramSDK.publishReel(
  igUserId,
  accessToken,
  'https://example.com/video.mp4',
  'نص الريل',
  'https://example.com/cover.jpg',
  true // مشاركة في الفيد
);
```

#### تحديث توكن طويل الأمد
```typescript
const refreshedToken = await instagramSDK.refreshLongLivedToken(longLivedToken);
```

#### البحث في هاشتاق
```typescript
const hashtagId = await instagramSDK.getHashtagId(igUserId, accessToken, 'travel');
const topMedia = await instagramSDK.getHashtagTopMedia(hashtagId, igUserId, accessToken, 25);
```

---

## TikTok SDK (v2)

### الميزات الجديدة
- دعم TikTok API v2
- نشر الفيديوهات من URL
- متابعة حالة النشر
- إلغاء التوكنات
- إحصائيات الفيديوهات المحسنة

### أمثلة الاستخدام

#### نشر فيديو
```typescript
import { tiktokSDK } from './sdk/tiktok';

const accessToken = 'USER_ACCESS_TOKEN';

const result = await tiktokSDK.publishVideoFromUrl(
  accessToken,
  'https://example.com/video.mp4',
  'عنوان الفيديو',
  'PUBLIC_TO_EVERYONE'
);

// متابعة حالة النشر
const publishId = result.data.publish_id;
const status = await tiktokSDK.checkPublishStatus(accessToken, publishId);
```

#### الحصول على معلومات المستخدم
```typescript
const userInfo = await tiktokSDK.getUserInfo(accessToken);
const creatorInfo = await tiktokSDK.getCreatorInfo(accessToken);
```

#### الحصول على إحصائيات الفيديو
```typescript
const videoInsights = await tiktokSDK.shareInsights(
  accessToken,
  videoId,
  ['LIKES', 'COMMENTS', 'SHARES', 'VIEWS']
);
```

---

## DeepSeek SDK (2025)

### الميزات الجديدة
- دعم نماذج deepseek-chat و deepseek-reasoner
- البث المباشر للردود (Streaming)
- التحقق من صلاحية API Key
- دعم كامل للتفكير المنطقي (Reasoning)

### أمثلة الاستخدام

#### توليد محتوى بسيط
```typescript
import { deepseekSDK } from './deepseek';

const content = await deepseekSDK.generateSimple(
  'اكتب منشور قصير عن السفر',
  'أنت كاتب محتوى محترف',
  { temperature: 0.8, max_tokens: 200 }
);
```

#### استخدام وضع التفكير المنطقي
```typescript
const result = await deepseekSDK.generateWithReasoning(
  'حل هذه المسألة الرياضية: ما هو 15% من 240؟',
  'أنت مساعد رياضي ذكي'
);

console.log('الإجابة:', result.content);
console.log('التفكير:', result.reasoning);
```

#### البث المباشر
```typescript
const stream = await deepseekSDK.streamChat([
  { role: 'user', content: 'اكتب قصة قصيرة' }
]);

// معالجة البث
for await (const chunk of stream) {
  // معالجة كل جزء من الرد
}
```

#### التحقق من API Key
```typescript
const isValid = await deepseekSDK.verifyApiKey();
if (isValid) {
  console.log('API Key صالح وجاهز للاستخدام');
}
```

---

## Cloudflare R2 Storage SDK (AWS SDK v3)

### الميزات الجديدة
- رفع الملفات من URL مباشرة
- حذف مجموعة ملفات دفعة واحدة
- نقل الملفات
- روابط عامة للملفات
- دعم كامل لـ presigned URLs

### أمثلة الاستخدام

#### رفع ملف
```typescript
import { r2Storage } from './r2-storage';

const fileBuffer = Buffer.from('محتوى الملف');
const url = await r2Storage.uploadFile(fileBuffer, 'images/photo.jpg', {
  contentType: 'image/jpeg',
  metadata: { userId: '123' },
});
```

#### رفع ملف من URL
```typescript
const url = await r2Storage.uploadFromUrl(
  'https://example.com/image.jpg',
  'uploads/image-copy.jpg',
  { contentType: 'image/jpeg' }
);
```

#### الحصول على رابط عام
```typescript
const publicUrl = await r2Storage.getPublicUrl('images/photo.jpg');
```

#### إنشاء Presigned URL للرفع
```typescript
const uploadUrl = await r2Storage.getUploadUrl(
  'uploads/new-file.jpg',
  'image/jpeg',
  3600 // صالح لمدة ساعة
);
// شارك هذا الرابط مع العميل للرفع المباشر
```

#### حذف عدة ملفات
```typescript
await r2Storage.batchDelete([
  'images/old1.jpg',
  'images/old2.jpg',
  'images/old3.jpg',
]);
```

#### نقل ملف
```typescript
await r2Storage.moveFile(
  'temp/file.jpg',
  'permanent/file.jpg'
);
```

---

## إدارة التوكنات

### Facebook & Instagram

```typescript
// 1. الحصول على توكن قصير الأمد من OAuth
const shortLivedToken = 'TOKEN_FROM_OAUTH';

// 2. تحويله لتوكن طويل الأمد (60 يوم)
const longLivedToken = await facebookSDK.getLongLivedToken(shortLivedToken);

// 3. للـ Instagram، يمكن تحديث التوكن
const refreshedToken = await instagramSDK.refreshLongLivedToken(longLivedToken.access_token);

// 4. التحقق من صلاحية التوكن
const tokenInfo = await facebookSDK.verifyAccessToken(longLivedToken.access_token);
console.log('Token valid until:', new Date(tokenInfo.expires_at! * 1000));
```

### TikTok

```typescript
// 1. الحصول على توكن من OAuth
const authResponse = await tiktokSDK.exchangeCodeForToken(code, redirectUri);

// 2. تحديث التوكن
const refreshedToken = await tiktokSDK.refreshAccessToken(authResponse.refresh_token);

// 3. إلغاء التوكن عند انتهاء الحاجة
await tiktokSDK.revokeAccessToken(authResponse.access_token);
```

---

## معالجة الأخطاء

جميع SDKs ترمي أخطاء واضحة يمكن معالجتها:

```typescript
try {
  const result = await facebookSDK.publishPost(pageId, accessToken, postData);
} catch (error) {
  if (error.message.includes('Invalid OAuth')) {
    // التوكن منتهي الصلاحية - احصل على توكن جديد
  } else if (error.message.includes('insufficient permissions')) {
    // المستخدم لم يمنح الصلاحيات المطلوبة
  } else {
    // خطأ عام
    console.error('Error:', error.message);
  }
}
```

---

## أفضل الممارسات

### 1. حفظ التوكنات بشكل آمن
```typescript
// استخدم Firestore لحفظ التوكنات
await firestoreService.saveUserIntegration(userId, 'facebook', {
  accessToken: longLivedToken.access_token,
  expiresAt: new Date(Date.now() + longLivedToken.expires_in * 1000),
});
```

### 2. التحقق من صلاحية التوكن قبل الاستخدام
```typescript
async function getValidToken(userId: string, platform: string) {
  const integration = await firestoreService.getUserIntegration(userId, platform);
  
  if (!integration || new Date(integration.expiresAt) < new Date()) {
    throw new Error('Token expired - user needs to re-authenticate');
  }
  
  return integration.accessToken;
}
```

### 3. استخدام معالجة الأخطاء المناسبة
```typescript
async function publishWithRetry(publishFn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await publishFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 4. استخدام R2 Storage للملفات الكبيرة
```typescript
// بدلاً من رفع الفيديو مباشرة إلى Facebook/Instagram/TikTok
// ارفعه أولاً إلى R2 واستخدم الرابط
const videoUrl = await r2Storage.uploadFile(videoBuffer, 'videos/story.mp4');
await instagramSDK.publishReel(igUserId, accessToken, videoUrl, caption);
```

---

## التحديثات الجديدة لعام 2025

### Facebook SDK
- ✅ دعم كامل لـ Graph API v22.0
- ✅ نشر Facebook Reels
- ✅ إدارة توكنات محسنة
- ✅ الحصول على صفحات المستخدم

### Instagram SDK  
- ✅ تحديث إلى Graph API v22.0
- ✅ تحديث توكنات طويلة الأمد تلقائياً
- ✅ البحث والتحليلات للهاشتاقات
- ✅ إحصائيات حساب متقدمة

### TikTok SDK
- ✅ دعم TikTok API v2
- ✅ نشر من URL مباشرة
- ✅ متابعة حالة النشر
- ✅ إحصائيات محسنة

### DeepSeek SDK
- ✅ دعم deepseek-chat و deepseek-reasoner
- ✅ البث المباشر للردود
- ✅ التحقق من API Key
- ✅ دعم التفكير المنطقي

### R2 Storage SDK
- ✅ AWS SDK v3 (أحدث إصدار)
- ✅ رفع من URL
- ✅ عمليات مجمعة
- ✅ روابط عامة ومؤقتة

---

## الدعم والمساعدة

لأي استفسارات أو مشاكل، يرجى التواصل مع فريق الدعم الفني.
