# دليل ربط المنصة بـ Render بشكل احترافي

لربط المستودع الخاص بك `social-stories-platform-production` بمنصة Render وضمان عملها بشكل كامل، اتبع الخطوات التالية:

## 1. إنشاء حساب في Render
- قم بزيارة [render.com](https://render.com) وسجل الدخول باستخدام حساب GitHub الخاص بك.

## 2. إنشاء "Blueprint Instance" (الطريقة الاحترافية)
- في لوحة تحكم Render، اضغط على **New** ثم اختر **Blueprint**.
- اختر مستودعك: `social-stories-platform-production`.
- سيقوم Render تلقائياً بقراءة ملف `render.yaml` الذي قمنا بتجهيزه.

## 3. ضبط متغيرات البيئة (Environment Variables)
أثناء عملية الـ Blueprint، سيطلب منك Render ملء القيم في مجموعة `social-platform-secrets`. تأكد من نقل القيم التالية من Replit إلى Render:

### Firebase
- `FIREBASE_SERVICE_ACCOUNT`: (محتوى ملف JSON الخاص بحساب الخدمة)
- `VITE_FIREBASE_*`: (جميع مفاتيح Firebase الخاصة بالواجهة الأمامية)

### AI & Storage
- `OPENAI_API_KEY`: مفتاح OpenAI
- `DEEPSEEK_API_KEY`: مفتاح DeepSeek (احتياطي)
- `CLOUDFLARE_R2_*`: إعدادات التخزين السحابي Cloudflare

### Security
- `CRON_SECRET_KEY`: نفس المفتاح الموجود في GitHub Secrets
- `SESSION_SECRET`: مفتاح عشوائي لتأمين الجلسات

## 4. الربط مع GitHub
- بمجرد الضغط على **Apply**، سيقوم Render ببناء التطبيق وربطه بالمستودع.
- أي تغيير تقوم برفعه إلى GitHub مستقبلاً سيتم نشره تلقائياً (Auto-Deploy).

## 5. الصحة والمراقبة
- المنصة مزودة بمسار `/api/admin/health` للتحقق من سلامة النظام.
- تم ضبط المنطقة الزمنية على `Asia/Riyadh` لضمان دقة الجدولة.
