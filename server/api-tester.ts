import type { APIConfig } from '@shared/schema';

interface TestResult {
  success: boolean;
  message: string;
}

export async function testAPIConnection(provider: string, config: APIConfig): Promise<TestResult> {
  try {
    switch (provider) {
      case 'facebook':
        return await testFacebookConnection(config);
      case 'instagram':
        return await testInstagramConnection(config);
      case 'tiktok':
        return await testTikTokConnection(config);
      case 'deepseek':
        return await testDeepSeekConnection(config);
      case 'cloudflare_r2':
        return await testCloudflareR2Connection(config);
      case 'youtube':
        return await testYouTubeConnection(config);
      case 'huggingface':
        return await testHuggingFaceConnection(config);
      case 'gemini':
        return await testGeminiConnection(config);
      case 'google_trends':
        return await testGoogleSearchConnection(config);
      case 'tmdb':
        return await testTMDBConnection(config);
      case 'github_actions':
        return await testHelioHostConnection(config);
      default:
        return {
          success: false,
          message: 'Unknown provider',
        };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
    };
  }
}

async function testFacebookConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.appId || !config.appSecret) {
      return {
        success: false,
        message: 'Facebook App ID and App Secret are required',
      };
    }

    const response = await fetch(`https://graph.facebook.com/oauth/access_token?client_id=${config.appId}&client_secret=${config.appSecret}&grant_type=client_credentials`);
    
    if (!response.ok) {
      let errorMessage = 'Invalid Facebook credentials or insufficient permissions';
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = `Facebook API Error: ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMessage = `Facebook API Error: ${errorData.message}`;
        } else {
          errorMessage = `Facebook API Error (Status ${response.status}): ${response.statusText}`;
        }
      } catch {
        errorMessage = `Facebook API Error (Status ${response.status}): ${response.statusText}`;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    if (data.access_token) {
      return {
        success: true,
        message: 'Facebook connection successful',
      };
    }

    return {
      success: false,
      message: 'Failed to obtain access token from Facebook',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to Facebook: ${error.message || 'Network error'}`,
    };
  }
}

async function testInstagramConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.appId || !config.appSecret) {
      return {
        success: false,
        message: 'Instagram App ID and App Secret are required',
      };
    }

    const response = await fetch(`https://graph.facebook.com/oauth/access_token?client_id=${config.appId}&client_secret=${config.appSecret}&grant_type=client_credentials`);
    
    if (!response.ok) {
      let errorMessage = 'Invalid Instagram credentials or insufficient permissions';
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = `Instagram API Error: ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMessage = `Instagram API Error: ${errorData.message}`;
        } else {
          errorMessage = `Instagram API Error (Status ${response.status}): ${response.statusText}`;
        }
      } catch {
        errorMessage = `Instagram API Error (Status ${response.status}): ${response.statusText}`;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    if (data.access_token) {
      return {
        success: true,
        message: 'Instagram connection successful',
      };
    }

    return {
      success: false,
      message: 'Failed to obtain access token from Instagram',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to Instagram: ${error.message || 'Network error'}`,
    };
  }
}

async function testTikTokConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey || !config.appSecret) {
      return {
        success: false,
        message: 'TikTok API Key and API Secret are required',
      };
    }

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: config.apiKey,
        client_secret: config.appSecret,
        grant_type: 'client_credentials',
      }),
    });
    
    if (!response.ok) {
      let errorMessage = 'Invalid TikTok credentials or insufficient permissions';
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = `TikTok API Error: ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMessage = `TikTok API Error: ${errorData.message}`;
        } else {
          errorMessage = `TikTok API Error (Status ${response.status}): ${response.statusText}`;
        }
      } catch {
        errorMessage = `TikTok API Error (Status ${response.status}): ${response.statusText}`;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    if (data.access_token || data.data?.access_token) {
      return {
        success: true,
        message: 'TikTok connection successful',
      };
    }

    return {
      success: false,
      message: 'Failed to obtain access token from TikTok',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to TikTok: ${error.message || 'Network error'}`,
    };
  }
}

async function testDeepSeekConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'مفتاح DeepSeek API مطلوب',
      };
    }

    console.log('[DeepSeek Test] Starting connection test...');
    console.log('[DeepSeek Test] API Key (masked):', config.apiKey.substring(0, 10) + '...');
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    });
    
    console.log('[DeepSeek Test] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMessage = 'مفتاح DeepSeek API غير صالح أو صلاحيات غير كافية';
      try {
        const errorData = await response.json();
        console.log('[DeepSeek Test] Error response:', JSON.stringify(errorData, null, 2));
        
        if (response.status === 401) {
          errorMessage = 'مفتاح DeepSeek API غير صالح - يرجى التحقق من المفتاح';
        } else if (response.status === 402) {
          errorMessage = 'رصيد حسابك في DeepSeek غير كافٍ - يرجى إضافة رصيد إلى حسابك';
        } else if (response.status === 403) {
          errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من حسابك وخطتك';
        } else if (response.status === 429) {
          errorMessage = 'تجاوزت الحد المسموح من الطلبات - يرجى المحاولة لاحقاً';
        } else if (errorData.error?.message) {
          if (errorData.error.message.includes('Insufficient Balance')) {
            errorMessage = 'رصيد حسابك في DeepSeek غير كافٍ - يرجى إضافة رصيد إلى حسابك';
          } else {
            errorMessage = `خطأ DeepSeek API: ${errorData.error.message}`;
          }
        } else if (errorData.message) {
          if (errorData.message.includes('Insufficient Balance')) {
            errorMessage = 'رصيد حسابك في DeepSeek غير كافٍ - يرجى إضافة رصيد إلى حسابك';
          } else {
            errorMessage = `خطأ DeepSeek API: ${errorData.message}`;
          }
        } else {
          errorMessage = `خطأ DeepSeek API (رمز ${response.status}): ${response.statusText}`;
        }
      } catch (parseError) {
        console.log('[DeepSeek Test] Failed to parse error response:', parseError);
        if (response.status === 402) {
          errorMessage = 'رصيد حسابك في DeepSeek غير كافٍ - يرجى إضافة رصيد إلى حسابك';
        } else {
          errorMessage = `خطأ DeepSeek API (رمز ${response.status}): ${response.statusText}`;
        }
      }
      
      console.log('[DeepSeek Test] Final error message:', errorMessage);
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const successData = await response.json();
    console.log('[DeepSeek Test] Success! Response:', JSON.stringify(successData, null, 2));

    return {
      success: true,
      message: 'نجح الاتصال بـ DeepSeek - المفتاح صالح ويعمل بشكل صحيح',
    };
  } catch (error: any) {
    console.log('[DeepSeek Test] Exception:', error);
    return {
      success: false,
      message: `فشل الاتصال بـ DeepSeek: ${error.message || 'خطأ في الشبكة'}`,
    };
  }
}

async function testCloudflareR2Connection(config: APIConfig): Promise<TestResult> {
  try {
    console.log('[R2 Test] Starting connection test...');
    
    if (!config.additionalConfig?.accountId) {
      console.log('[R2 Test] Missing accountId');
      return { success: false, message: 'معرف حساب Cloudflare R2 مطلوب' };
    }
    if (!config.additionalConfig?.accessKeyId) {
      console.log('[R2 Test] Missing accessKeyId');
      return { success: false, message: 'معرف مفتاح الوصول Cloudflare R2 مطلوب' };
    }
    if (!config.additionalConfig?.secretAccessKey) {
      console.log('[R2 Test] Missing secretAccessKey');
      return { success: false, message: 'مفتاح الوصول السري Cloudflare R2 مطلوب' };
    }
    if (!config.additionalConfig?.bucketName) {
      console.log('[R2 Test] Missing bucketName');
      return { success: false, message: 'اسم دلو Cloudflare R2 مطلوب' };
    }

    console.log('[R2 Test] Account ID:', config.additionalConfig.accountId);
    console.log('[R2 Test] Access Key ID (masked):', config.additionalConfig.accessKeyId.substring(0, 8) + '...');
    console.log('[R2 Test] Bucket Name:', config.additionalConfig.bucketName);
    console.log('[R2 Test] Endpoint:', `https://${config.additionalConfig.accountId}.r2.cloudflarestorage.com`);

    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.additionalConfig.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.additionalConfig.accessKeyId,
        secretAccessKey: config.additionalConfig.secretAccessKey,
      },
    });

    console.log('[R2 Test] Sending HeadBucket command...');
    await r2Client.send(new HeadBucketCommand({
      Bucket: config.additionalConfig.bucketName,
    }));

    console.log('[R2 Test] Connection successful!');
    return {
      success: true,
      message: 'تم الاتصال بـ Cloudflare R2 بنجاح',
    };
  } catch (error: any) {
    console.error('[R2 Test] Error occurred:', error);
    console.error('[R2 Test] Error name:', error.name);
    console.error('[R2 Test] Error code:', error.Code || error.code);
    console.error('[R2 Test] Error message:', error.message);
    console.error('[R2 Test] HTTP status code:', error.$metadata?.httpStatusCode);
    console.error('[R2 Test] Full error object:', JSON.stringify(error, null, 2));
    
    let errorMessage = 'فشل الاتصال بـ Cloudflare R2';
    
    const httpStatusCode = error.$metadata?.httpStatusCode;
    const errorCode = error.Code || error.code || error.name;
    
    if (errorCode === 'InvalidAccessKeyId' || httpStatusCode === 403) {
      errorMessage = 'خطأ Cloudflare R2: معرف مفتاح الوصول غير صالح. تحقق من صحة Access Key ID';
    } else if (errorCode === 'SignatureDoesNotMatch') {
      errorMessage = 'خطأ Cloudflare R2: مفتاح الوصول السري غير صالح. تحقق من صحة Secret Access Key';
    } else if (errorCode === 'NoSuchBucket' || httpStatusCode === 404) {
      errorMessage = 'خطأ Cloudflare R2: الدلو المحدد غير موجود. تحقق من اسم Bucket';
    } else if (errorCode === 'InvalidBucketName') {
      errorMessage = 'خطأ Cloudflare R2: اسم الدلو غير صالح';
    } else if (errorCode === 'NetworkingError' || error.message?.includes('getaddrinfo')) {
      errorMessage = 'خطأ Cloudflare R2: خطأ في الاتصال بالشبكة. تحقق من Account ID';
    } else if (httpStatusCode === 401) {
      errorMessage = 'خطأ Cloudflare R2: خطأ في المصادقة. تحقق من Access Key ID و Secret Access Key';
    } else if (error.message) {
      errorMessage = `خطأ Cloudflare R2: ${error.message}`;
    }
    
    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function testYouTubeConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'مفتاح YouTube API مطلوب',
      };
    }

    const { YouTubeMusicService } = await import('./youtube-music.js');
    const youtubeService = new YouTubeMusicService(config.apiKey);
    
    return await youtubeService.testConnection();
  } catch (error: any) {
    return {
      success: false,
      message: `فشل الاتصال بـ YouTube API: ${error.message || 'خطأ في الشبكة'}`,
    };
  }
}

async function testHuggingFaceConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'مفتاح Hugging Face API مطلوب',
      };
    }

    console.log('[HuggingFace Test] Starting connection test...');
    console.log('[HuggingFace Test] Token (masked):', config.apiKey.substring(0, 10) + '...');

    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
    
    console.log('[HuggingFace Test] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMessage = 'مفتاح Hugging Face API غير صالح';
      
      if (response.status === 401) {
        errorMessage = 'مفتاح Hugging Face API غير صالح - يرجى التحقق من Access Token. تأكد من أن الـ Token من نوع "Read" أو "Write"';
      } else if (response.status === 403) {
        errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من صلاحيات Access Token';
      } else if (response.status === 429) {
        errorMessage = 'تجاوزت الحد المسموح من الطلبات - يرجى الانتظار قليلاً ثم المحاولة مرة أخرى';
      } else {
        try {
          const errorData = await response.json();
          console.log('[HuggingFace Test] Error data:', JSON.stringify(errorData));
          if (errorData.error) {
            errorMessage = `خطأ Hugging Face API: ${errorData.error}`;
          }
        } catch (parseError) {
          console.log('[HuggingFace Test] Failed to parse error response');
          errorMessage = `خطأ Hugging Face API (رمز ${response.status}): ${response.statusText}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const userData = await response.json();
    console.log('[HuggingFace Test] User data received:', JSON.stringify(userData, null, 2));
    
    if (userData.error) {
      console.log('[HuggingFace Test] Error in response body:', userData.error);
      let errorMessage = `خطأ Hugging Face: ${userData.error}`;
      
      if (userData.estimated_time) {
        errorMessage = `النموذج قيد التحميل، يرجى الانتظار ${Math.ceil(userData.estimated_time)} ثانية ثم المحاولة مرة أخرى`;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
    
    if (!userData.name && !userData.id && !userData.fullname && !userData.username) {
      console.log('[HuggingFace Test] No valid user data received');
      
      if (userData.estimated_time) {
        return {
          success: false,
          message: `لم نتمكن من التحقق من المفتاح. النموذج قيد التحميل (${Math.ceil(userData.estimated_time)} ثانية) - يرجى المحاولة مرة أخرى لاحقاً`,
        };
      }
      
      return {
        success: false,
        message: 'مفتاح Hugging Face API غير صالح أو استجابة غير متوقعة - يرجى التحقق من Access Token',
      };
    }
    
    const accountName = userData.name || userData.fullname || userData.username || userData.id;
    const accountType = userData.type || 'user';
    
    let infoMessage = `نجح الاتصال بـ Hugging Face! الحساب: ${accountName}`;
    
    if (accountType === 'org') {
      infoMessage += ' (منظمة)';
    }
    
    if (userData.canPay === false) {
      infoMessage += ' - حساب مجاني (يمكنك توليد الصور مجاناً باستخدام Hugging Face Inference)';
    } else {
      infoMessage += ' - جاهز لتوليد الصور مجاناً';
    }
    
    console.log('[HuggingFace Test] Connection successful!');
    
    return {
      success: true,
      message: infoMessage,
    };
  } catch (error: any) {
    console.error('[HuggingFace Test] Exception:', error);
    
    if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: 'فشل الاتصال بـ Hugging Face - تحقق من اتصال الإنترنت',
      };
    }
    
    return {
      success: false,
      message: `فشل الاتصال بـ Hugging Face API: ${error.message || 'خطأ غير معروف'}`,
    };
  }
}

async function testGeminiConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'مفتاح Gemini API مطلوب',
      };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Hello'
          }]
        }]
      }),
    });
    
    if (!response.ok) {
      let errorMessage = 'مفتاح Gemini API غير صالح';
      
      if (response.status === 400) {
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = `خطأ Gemini API: ${errorData.error.message}`;
          }
        } catch {
          errorMessage = 'مفتاح Gemini API غير صالح أو غير مفعّل';
        }
      } else if (response.status === 403) {
        errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من مفتاح API والتأكد من تفعيل Gemini API';
      } else {
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = `خطأ Gemini API: ${errorData.error.message}`;
          }
        } catch {
          errorMessage = `خطأ Gemini API (رمز ${response.status}): ${response.statusText}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      return {
        success: true,
        message: 'نجح الاتصال بـ Gemini API - المفتاح صالح ويعمل بشكل صحيح!',
      };
    }
    
    return {
      success: false,
      message: 'استجابة غير متوقعة من Gemini API',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `فشل الاتصال بـ Gemini API: ${error.message || 'خطأ في الشبكة'}`,
    };
  }
}

async function testGoogleSearchConnection(config: APIConfig): Promise<TestResult> {
  try {
    const apiKey = config.apiKey;
    const searchEngineId = config.additionalConfig?.searchEngineId;

    if (!apiKey) {
      return {
        success: false,
        message: 'مفتاح Google Custom Search API مطلوب',
      };
    }

    if (!searchEngineId) {
      return {
        success: false,
        message: 'معرف محرك البحث (Search Engine ID) مطلوب',
      };
    }

    console.log('[Google Search Test] Starting connection test...');
    console.log('[Google Search Test] API Key (masked):', apiKey.substring(0, 10) + '...');
    console.log('[Google Search Test] Search Engine ID:', searchEngineId);

    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: 'test',
      searchType: 'image',
      num: '1',
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`
    );

    console.log('[Google Search Test] Response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = 'بيانات Google Custom Search API غير صالحة';
      
      try {
        const errorData = await response.json();
        console.log('[Google Search Test] Error response:', JSON.stringify(errorData, null, 2));
        
        if (response.status === 400) {
          if (errorData.error?.message?.includes('API key not valid')) {
            errorMessage = 'مفتاح Google API غير صالح - يرجى التحقق من المفتاح';
          } else if (errorData.error?.message?.includes('cx')) {
            errorMessage = 'معرف محرك البحث (CX) غير صالح - يرجى التحقق من Search Engine ID';
          } else {
            errorMessage = `خطأ Google API: ${errorData.error?.message || 'طلب غير صالح'}`;
          }
        } else if (response.status === 401) {
          errorMessage = 'مفتاح Google API غير صالح - يرجى التحقق من المفتاح والتأكد من تفعيل Custom Search API';
        } else if (response.status === 403) {
          if (errorData.error?.message?.includes('quota')) {
            errorMessage = 'تم تجاوز حصة الاستخدام اليومية لـ Google API - حاول مرة أخرى غداً';
          } else if (errorData.error?.message?.includes('disabled')) {
            errorMessage = 'Google Custom Search API غير مفعّل - يرجى تفعيله من Google Cloud Console';
          } else {
            errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من المفتاح وتفعيل Custom Search API';
          }
        } else if (response.status === 429) {
          errorMessage = 'تم تجاوز حد الطلبات - يرجى المحاولة لاحقاً';
        } else if (errorData.error?.message) {
          errorMessage = `خطأ Google API: ${errorData.error.message}`;
        }
      } catch (parseError) {
        console.log('[Google Search Test] Failed to parse error response:', parseError);
        errorMessage = `خطأ Google API (رمز ${response.status}): ${response.statusText}`;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    console.log('[Google Search Test] Success! Items found:', data.items?.length || 0);

    return {
      success: true,
      message: 'نجح الاتصال بـ Google Custom Search API - المفتاح ومعرف محرك البحث يعملان بشكل صحيح!',
    };
  } catch (error: any) {
    console.log('[Google Search Test] Exception:', error);
    return {
      success: false,
      message: `فشل الاتصال بـ Google Search API: ${error.message || 'خطأ في الشبكة'}`,
    };
  }
}

async function testTMDBConnection(config: APIConfig): Promise<TestResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'مفتاح TMDB API مطلوب',
      };
    }

    console.log('[TMDB Test] Starting connection test...');
    console.log('[TMDB Test] API Key (masked):', config.apiKey.substring(0, 10) + '...');

    const response = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${config.apiKey}`
    );

    console.log('[TMDB Test] Response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = 'مفتاح TMDB API غير صالح';
      
      try {
        const errorData = await response.json();
        console.log('[TMDB Test] Error response:', JSON.stringify(errorData, null, 2));
        
        if (response.status === 401) {
          errorMessage = 'مفتاح TMDB API غير صالح - يرجى التحقق من المفتاح';
        } else if (response.status === 403) {
          errorMessage = 'ليس لديك صلاحية الوصول - يرجى التحقق من حسابك في TMDB';
        } else if (response.status === 429) {
          errorMessage = 'تجاوزت الحد المسموح من الطلبات - يرجى المحاولة لاحقاً';
        } else if (errorData.status_message) {
          errorMessage = `خطأ TMDB API: ${errorData.status_message}`;
        } else {
          errorMessage = `خطأ TMDB API (رمز ${response.status}): ${response.statusText}`;
        }
      } catch (parseError) {
        console.log('[TMDB Test] Failed to parse error response:', parseError);
        errorMessage = `خطأ TMDB API (رمز ${response.status}): ${response.statusText}`;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }

    const data = await response.json();
    console.log('[TMDB Test] Configuration received successfully');

    if (data.images && data.images.base_url) {
      return {
        success: true,
        message: 'نجح الاتصال بـ TMDB API - المفتاح صالح وجاهز لجلب بيانات الأفلام والمسلسلات!',
      };
    }

    return {
      success: false,
      message: 'استجابة غير متوقعة من TMDB API',
    };
  } catch (error: any) {
    console.log('[TMDB Test] Exception:', error);
    return {
      success: false,
      message: `فشل الاتصال بـ TMDB API: ${error.message || 'خطأ في الشبكة'}`,
    };
  }
}

async function testHelioHostConnection(config: APIConfig): Promise<TestResult> {
  try {
    console.log('[GitHub Test] ================================');
    console.log('[GitHub Test] Starting connection test...');
    
    const webhookUrl = (config.additionalConfig as any)?.webhookUrl;
    if (!webhookUrl || webhookUrl.trim() === '') {
      console.log('[GitHub Test] Missing or empty webhookUrl');
      return {
        success: false,
        message: 'رابط السيرفر مطلوب (مثال: https://turk.github.com)',
      };
    }

    // Validate URL format
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      console.log('[GitHub Test] Invalid URL format');
      return {
        success: false,
        message: 'رابط غير صالح - يجب أن يبدأ بـ http:// أو https://',
      };
    }

    console.log('[GitHub Test] Webhook URL:', webhookUrl);
    const cronSecretKey = process.env.CRON_SECRET_KEY;
    
    if (!cronSecretKey) {
      console.log('[GitHub Test] Missing CRON_SECRET_KEY environment variable');
      return {
        success: false,
        message: 'متغير البيئة CRON_SECRET_KEY غير محدد - يرجى التحقق من إعدادات الخادم',
      };
    }

    console.log('[GitHub Test] CRON_SECRET_KEY is set (masked):', cronSecretKey.substring(0, 10) + '...');
    console.log('[GitHub Test] Making test request to:', `${webhookUrl}/api/cron/trigger`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let response;
    try {
      response = await fetch(`${webhookUrl}/api/cron/trigger`, {
        method: 'POST',
        headers: {
          'x-cron-secret': cronSecretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    console.log('[GitHub Test] Response status:', response.status, response.statusText);

    if (response.ok || response.status === 200 || response.status === 202) {
      console.log('[GitHub Test] ✅ Connection successful!');
      return {
        success: true,
        message: 'نجح الاتصال بـ GitHub - الخادم يستجيب بشكل صحيح وجاهز للعمل',
      };
    }

    if (response.status === 401 || response.status === 403) {
      console.log('[GitHub Test] ❌ Unauthorized - CRON_SECRET_KEY mismatch');
      return {
        success: false,
        message: 'فشل الاتصال: مفتاح CRON_SECRET_KEY غير صحيح أو لا يتطابق - تحقق من أنك أدخلت الرابط الصحيح وأن المفتاح محفوظ في الخادم',
      };
    }

    if (response.status === 404) {
      console.log('[GitHub Test] ❌ Not Found - Endpoint does not exist');
      return {
        success: false,
        message: 'فشل الاتصال: الـ endpoint غير موجود - تأكد من أن رابط GitHub صحيح وأن التطبيق مُنشر هناك',
      };
    }

    if (response.status === 500 || response.status === 502 || response.status === 503) {
      console.log('[GitHub Test] ❌ Server error');
      return {
        success: false,
        message: `فشل الاتصال: خطأ من الخادم (رمز ${response.status}) - الخادم قد لا يكون جاهزاً أو حدث خطأ عليه`,
      };
    }

    console.log('[GitHub Test] ❌ Unexpected status code');
    return {
      success: false,
      message: `فشل الاتصال بـ GitHub (رمز ${response.status}): ${response.statusText} - تحقق من رابط GitHub`,
    };
  } catch (error: any) {
    console.log('[GitHub Test] ❌ Exception caught:', error.message);
    console.log('[GitHub Test] Error type:', error.name);
    
    if (error.name === 'AbortError') {
      console.log('[GitHub Test] Request timeout');
      return {
        success: false,
        message: 'فشل الاتصال: انتهت المهلة الزمنية - الخادم لا يستجيب خلال 15 ثانية - تحقق من الاتصال بالإنترنت ورابط GitHub',
      };
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.log('[GitHub Test] Connection refused');
      return {
        success: false,
        message: 'فشل الاتصال: تم رفض الاتصال - تأكد من أن رابط GitHub صحيح وأن الخادم يعمل',
      };
    }

    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('[GitHub Test] Domain not found');
      return {
        success: false,
        message: 'فشل الاتصال: النطاق غير موجود أو غير صحيح - تحقق من رابط السيرفر (مثلاً: https://turk.github.com)',
      };
    }

    if (error.message.includes('ECONNRESET')) {
      console.log('[GitHub Test] Connection reset');
      return {
        success: false,
        message: 'فشل الاتصال: تم إعادة تعيين الاتصال - قد يكون هناك مشكلة في الشبكة أو الخادم',
      };
    }

    console.log('[GitHub Test] ================================');
    return {
      success: false,
      message: `فشل الاتصال بـ GitHub: ${error.message || 'خطأ غير معروف في الشبكة'}`,
    };
  }
}
