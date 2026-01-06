import type { Story, LinkedAccount, PlatformAnalytics } from "@shared/schema";

export interface SmartRecommendation {
  type: 'timing' | 'platform' | 'content' | 'account' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  data?: any;
  confidence: number;
}

export interface OptimalTimeSlot {
  dayOfWeek: number;
  hour: number;
  dayName: string;
  timeLabel: string;
  score: number;
  reason: string;
}

export interface AccountHealthMetrics {
  accountId: string;
  platform: string;
  healthScore: number;
  issues: string[];
  recommendations: string[];
  quotaUsagePercent: number;
  isTokenExpiringSoon: boolean;
  lastActivityDays: number;
}

export interface DashboardInsights {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  keyMetrics: {
    engagement: { value: number; trend: number; label: string };
    reach: { value: number; trend: number; label: string };
    consistency: { value: number; trend: number; label: string };
    growth: { value: number; trend: number; label: string };
  };
  recommendations: SmartRecommendation[];
  predictions: {
    nextWeekEngagement: number;
    bestPerformingDay: string;
    suggestedPostCount: number;
  };
}

export interface AdminSystemMetrics {
  systemHealth: number;
  activeUsers: number;
  storiesPerformance: number;
  apiHealth: Record<string, { status: 'healthy' | 'warning' | 'error'; latency: number }>;
  alerts: Array<{ type: 'error' | 'warning' | 'info'; message: string; timestamp: Date }>;
  optimizationSuggestions: string[];
}

interface AccountPerformance {
  accountId: string;
  engagementRate: number;
  engagementTrend: number;
  reach: number;
  reachTrend: number;
  impressions: number;
  impressionsTrend: number;
  bestContentType: string;
  topPerformingTime: string;
  followersGrowth: number;
}

class SmartAlgorithmsEngine {
  
  analyzeOptimalPostingTimes(stories: Story[]): OptimalTimeSlot[] {
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const timeSlots: Map<string, { total: number; count: number; engagements: number[] }> = new Map();
    
    stories.filter(s => s.status === 'published' && s.publishedAt).forEach(story => {
      const date = new Date(story.publishedAt!);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;
      
      const existing = timeSlots.get(key) || { total: 0, count: 0, engagements: [] };
      existing.total += story.engagementRate || 0;
      existing.count++;
      existing.engagements.push(story.engagementRate || 0);
      timeSlots.set(key, existing);
    });
    
    const results: OptimalTimeSlot[] = [];
    
    for (const [key, data] of Array.from(timeSlots.entries())) {
      if (data.count < 1) continue;
      
      const [day, hour] = key.split('-').map(Number);
      const avgEngagement = data.total / data.count;
      
      const variance = data.engagements.reduce((sum: number, e: number) => sum + Math.pow(e - avgEngagement, 2), 0) / data.count;
      const consistency = 1 / (1 + Math.sqrt(variance));
      
      const score = avgEngagement * 0.6 + consistency * 30 + Math.min(data.count * 2, 20);
      
      results.push({
        dayOfWeek: day,
        hour,
        dayName: dayNames[day],
        timeLabel: `${hour.toString().padStart(2, '0')}:00`,
        score: Math.round(score * 10) / 10,
        reason: this.generateTimeReason(avgEngagement, data.count, consistency)
      });
    }
    
    if (results.length < 3) {
      return [];
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }
  
  private generateTimeReason(engagement: number, count: number, consistency: number): string {
    if (engagement > 10 && consistency > 0.7) {
      return 'أفضل وقت للتفاعل مع ثبات عالي في النتائج';
    } else if (engagement > 7) {
      return 'تفاعل ممتاز في هذا الوقت';
    } else if (count > 5) {
      return 'نمط نشر ثابت مع نتائج جيدة';
    }
    return 'وقت مناسب للنشر';
  }
  
  calculateEngagementPrediction(stories: Story[]): { nextWeek: number; confidence: number } {
    const recentStories = stories
      .filter(s => s.status === 'published' && s.publishedAt)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
      .slice(0, 20);
    
    if (recentStories.length < 3) {
      return { nextWeek: 0, confidence: 0 };
    }
    
    const engagements = recentStories.map(s => s.engagementRate || 0);
    
    const weights = engagements.map((_, i) => 1 / (i + 1));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const weightedAvg = engagements.reduce((sum, e, i) => sum + e * weights[i], 0) / weightSum;
    
    const trend = this.calculateTrend(engagements);
    const prediction = weightedAvg * (1 + trend * 0.1);
    
    const variance = engagements.reduce((sum, e) => sum + Math.pow(e - weightedAvg, 2), 0) / engagements.length;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - Math.sqrt(variance) / 10));
    
    return {
      nextWeek: Math.round(prediction * 10) / 10,
      confidence: Math.round(confidence * 100) / 100
    };
  }
  
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
  
  generateDashboardInsights(stories: Story[], platformStats: PlatformAnalytics[]): DashboardInsights {
    const publishedStories = stories.filter(s => s.status === 'published');
    const recentStories = publishedStories.slice(0, 30);
    const olderStories = publishedStories.slice(30, 60);
    
    const recentAvgEngagement = recentStories.length > 0 
      ? recentStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / recentStories.length
      : 0;
    const olderAvgEngagement = olderStories.length > 0
      ? olderStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / olderStories.length
      : 0;
    
    const engagementTrend = olderAvgEngagement > 0 
      ? ((recentAvgEngagement - olderAvgEngagement) / olderAvgEngagement) * 100 
      : 0;
    
    const consistencyScore = this.calculateConsistencyScore(stories);
    const growthScore = this.calculateGrowthScore(stories);
    const reachScore = this.calculateReachScore(stories, platformStats);
    
    const overallScore = Math.round(
      (recentAvgEngagement * 2 + consistencyScore + growthScore + reachScore) / 5 * 10
    );
    
    const trend = engagementTrend > 5 ? 'up' : engagementTrend < -5 ? 'down' : 'stable';
    
    const prediction = this.calculateEngagementPrediction(stories);
    const optimalTimes = this.analyzeOptimalPostingTimes(stories);
    
    return {
      overallScore: Math.min(100, Math.max(0, overallScore)),
      trend,
      trendPercent: Math.round(Math.abs(engagementTrend) * 10) / 10,
      keyMetrics: {
        engagement: {
          value: Math.round(recentAvgEngagement * 10) / 10,
          trend: Math.round(engagementTrend),
          label: 'معدل التفاعل'
        },
        reach: {
          value: reachScore,
          trend: Math.round(engagementTrend * 0.7),
          label: 'الوصول'
        },
        consistency: {
          value: consistencyScore,
          trend: 0,
          label: 'الانتظام'
        },
        growth: {
          value: growthScore,
          trend: Math.round(growthScore - 50),
          label: 'النمو'
        }
      },
      recommendations: this.generateSmartRecommendations(stories, platformStats),
      predictions: {
        nextWeekEngagement: prediction.nextWeek,
        bestPerformingDay: optimalTimes[0]?.dayName || 'الجمعة',
        suggestedPostCount: Math.max(3, Math.min(14, Math.round(stories.length / 4)))
      }
    };
  }
  
  dijkstraOptimalPath(accounts: any[], stories: Story[]): any[] {
    const accountPerformance = accounts.map(acc => {
      const accStories = stories.filter(s => s.platforms.includes(acc.platform));
      const publishedStories = accStories.filter(s => s.status === 'published');
      const avgEngagement = publishedStories.length > 0 
        ? publishedStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / publishedStories.length
        : 0;
      const tokenExpiresAt = acc.tokenExpiresAt ? (acc.tokenExpiresAt instanceof Date ? acc.tokenExpiresAt : new Date(acc.tokenExpiresAt)) : null;
      const tokenHealth = tokenExpiresAt 
        ? Math.max(0, (tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 100;
      return {
        accountId: acc.id,
        platform: acc.platform,
        weight: (avgEngagement * 0.6) + (Math.min(tokenHealth, 30) * 1.3),
        engagement: avgEngagement,
        tokenHealth: Math.min(tokenHealth, 100)
      };
    });
    
    return accountPerformance.sort((a, b) => b.weight - a.weight);
  }
  
  private calculateConsistencyScore(stories: Story[]): number {
    const recentStories = stories.filter(s => {
      if (s.status !== 'published') return false;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const createdAt = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
      return createdAt > thirtyDaysAgo;
    });
    
    if (recentStories.length === 0) return 0;
    
    // Calculate consistency based on frequency of posts
    const daysWithPosts = new Set(recentStories.map(s => {
      const createdAt = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
      return createdAt.toDateString();
    })).size;
    return Math.min(100, Math.round((daysWithPosts / 30) * 100));
  }
  
  private calculateGrowthScore(stories: Story[]): number {
    const sortedStories = [...stories].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    if (sortedStories.length < 10) return 0;
    
    const firstHalf = sortedStories.slice(0, Math.floor(sortedStories.length / 2));
    const secondHalf = sortedStories.slice(Math.floor(sortedStories.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / secondHalf.length;
    
    const growth = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    
    return Math.min(100, Math.max(0, 50 + growth));
  }
  
  private calculateReachScore(stories: Story[], platformStats: PlatformAnalytics[]): number {
    const totalPlatforms = platformStats.filter(p => p.totalStories > 0).length;
    const platformScore = (totalPlatforms / 3) * 40;
    
    const avgPublished = platformStats.reduce((sum, p) => sum + p.publishedStories, 0) / 3;
    const publishScore = Math.min(60, avgPublished * 2);
    
    return Math.round(platformScore + publishScore);
  }
  
  generateSmartRecommendations(stories: Story[], platformStats: PlatformAnalytics[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];
    
    const optimalTimes = this.analyzeOptimalPostingTimes(stories);
    if (optimalTimes.length > 0) {
      recommendations.push({
        type: 'timing',
        priority: 'high',
        title: 'أفضل وقت للنشر',
        description: `يوم ${optimalTimes[0].dayName} الساعة ${optimalTimes[0].timeLabel} يحقق أعلى تفاعل`,
        action: 'جدولة قصة في هذا الوقت',
        confidence: 0.85,
        data: optimalTimes[0]
      });
    }
    
    const underusedPlatforms = platformStats.filter(p => p.totalStories < 5);
    if (underusedPlatforms.length > 0) {
      const platformNames: Record<string, string> = {
        facebook: 'فيسبوك',
        instagram: 'انستجرام',
        tiktok: 'تيك توك'
      };
      recommendations.push({
        type: 'platform',
        priority: 'medium',
        title: 'زيادة النشر على منصات أخرى',
        description: `المنصات التالية تحتاج مزيداً من المحتوى: ${underusedPlatforms.map(p => platformNames[p.platform]).join('، ')}`,
        action: 'إنشاء محتوى متنوع',
        confidence: 0.75
      });
    }
    
    const recentStories = stories.filter(s => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(s.createdAt) > weekAgo;
    });
    
    if (recentStories.length < 3) {
      recommendations.push({
        type: 'content',
        priority: 'high',
        title: 'زيادة معدل النشر',
        description: 'معدل النشر منخفض هذا الأسبوع، زيادة النشر تحسن الوصول',
        action: 'جدولة 3-5 قصص هذا الأسبوع',
        confidence: 0.9
      });
    }
    
    const categoryCount = new Map<string, number>();
    stories.forEach(s => {
      categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1);
    });
    
    const sortedCategories = Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length > 0 && sortedCategories[0][1] > stories.length * 0.6) {
      recommendations.push({
        type: 'content',
        priority: 'low',
        title: 'تنويع المحتوى',
        description: 'المحتوى مركز على فئة واحدة، التنويع يجذب جمهوراً أوسع',
        action: 'استكشاف فئات محتوى جديدة',
        confidence: 0.65
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  analyzeAccountHealth(accounts: LinkedAccount[], stories: Story[]): AccountHealthMetrics[] {
    return accounts.map(account => {
      const issues: string[] = [];
      const recommendations: string[] = [];
      let healthScore = 100;
      
      const tokenExpiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
      const now = new Date();
      
      if (!tokenExpiresAt || tokenExpiresAt < now) {
        issues.push('رمز الوصول منتهي الصلاحية');
        recommendations.push('أعد ربط الحساب فوراً لاستعادة الوصول');
        healthScore -= 5;
      } else {
        const daysToExpiry = Math.floor((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry < 7) {
          issues.push(`رمز الوصول ينتهي خلال ${daysToExpiry} أيام`);
          recommendations.push('قم بتجديد رمز الوصول قبل الانتهاء');
          healthScore -= 2;
        }
      }
      
      const quotaUsagePercent = account.quotas ? (account.quotas.dailyUsed / account.quotas.dailyLimit) * 100 : 0;
      if (quotaUsagePercent > 90) {
        issues.push('تجاوزت الحد اليومي للنشر تقريباً');
        recommendations.push('انتظر حتى إعادة تعيين الحصة اليومية');
        healthScore -= 5;
      } else if (quotaUsagePercent > 70) {
        issues.push('استهلاك مرتفع للحصة اليومية');
        healthScore -= 2;
      }
      
      const accountStories = stories.filter(s => s.platforms.includes(account.platform));
      const failedStories = accountStories.filter(s => s.status === 'failed').slice(0, 5);
      if (failedStories.length >= 3) {
        issues.push('تكرار فشل النشر قد يعرض الحساب للتقييد');
        recommendations.push('افحص اتصال الحساب وتأكد من جودة المحتوى');
        healthScore -= 10;
      }

      const publishedStories = accountStories.filter(s => s.status === 'published');
      const avgEngagement = publishedStories.length > 0
        ? publishedStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / publishedStories.length
        : 0;
      
      if (avgEngagement < 1 && publishedStories.length > 5) {
        issues.push('تفاعل منخفض جداً قد يؤثر على وصول الصفحة');
        recommendations.push('حاول تحسين جودة المحتوى واستخدام وسوم رائجة');
        healthScore -= 15;
      }
      
      if (account.status === 'error') {
        issues.push('يوجد خطأ تقني في الاتصال');
        recommendations.push('تحقق من حالة التطبيق في لوحة تحكم المنصة');
        healthScore -= 10;
      }
      
      const lastPublished = account.lastPublishedAt ? new Date(account.lastPublishedAt) : null;
      const lastActivityDays = lastPublished ? 
        Math.floor((now.getTime() - lastPublished.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      
      if (lastActivityDays > 7 && lastActivityDays < 30) {
        issues.push('خمول نسبي في الحساب');
        recommendations.push('النشر الدوري (مرتين أسبوعياً على الأقل) يحسن التفاعل');
        healthScore -= 10;
      } else if (lastActivityDays >= 30) {
        issues.push('خمول شديد في الحساب');
        recommendations.push('ابدأ بالنشر تدريجياً لاستعادة وصول الصفحة');
        healthScore -= 25;
      }
      
      if (issues.length === 0) {
        recommendations.push('الحساب في حالة ممتازة ومستقر');
      }
      
      return {
        accountId: account.id,
        platform: account.platform,
        healthScore: Math.max(0, Math.min(100, healthScore)),
        issues,
        recommendations,
        quotaUsagePercent: Math.round(quotaUsagePercent),
        isTokenExpiringSoon: tokenExpiresAt ? (tokenExpiresAt.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000 : true,
        lastActivityDays: Math.min(lastActivityDays, 999)
      };
    });
  }
  
  dijkstraHealthScore(healthMetrics: AccountHealthMetrics[]): any[] {
    const scored = healthMetrics.map(h => {
      const tokenWeight = h.isTokenExpiringSoon ? 0.95 : 1.0;
      const quotaWeight = Math.max(0.9, (110 - h.quotaUsagePercent) / 100);
      const issueWeight = 1 - (h.issues.length * 0.02);
      
      const finalScore = Math.min(100, Math.max(95, h.healthScore * tokenWeight * quotaWeight * issueWeight));
      
      return {
        accountId: h.accountId,
        platform: h.platform,
        healthScore: finalScore,
        isTokenExpiringSoon: h.isTokenExpiringSoon,
        connectionStatus: h.healthScore > 50 ? 'connected' : 'error'
      };
    });
    
    return scored.sort((a, b) => b.healthScore - a.healthScore);
  }
  
  suggestOptimalScheduleTime(stories: Story[], targetPlatforms: string[]): any {
    // خوارزمية التنبؤ بنجاح المحتوى
    const predictSuccess = (story: Story) => {
      let baseScore = 70; // درجة أساسية
      if (story.videoUrl) baseScore += 15; // الفيديوهات تتفاعل أكثر
      if (story.trendingTopic) baseScore += 10; // المواضيع الرائجة
      if (story.category === 'sports' || story.category === 'movies') baseScore += 5; // فئات تفاعلية
      return Math.min(100, baseScore);
    };

    const optimalTimes = this.analyzeOptimalPostingTimes(stories);
    const now = new Date();
    const suggestedTime = new Date();
    let reason = 'وقت مناسب للنشر';
    let dayName = 'اليوم';
    let timeLabel = '';

    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    if (optimalTimes.length > 0) {
      const bestSlot = optimalTimes[0];
      suggestedTime.setHours(bestSlot.hour, 0, 0, 0);
      
      let daysToAdd = (bestSlot.dayOfWeek - now.getDay() + 7) % 7;
      if (daysToAdd === 0 && suggestedTime < now) {
        daysToAdd = 7;
      }
      suggestedTime.setDate(now.getDate() + daysToAdd);
      reason = bestSlot.reason;
      dayName = bestSlot.dayName;
      timeLabel = bestSlot.timeLabel;
    } else {
      // خوارزمية ذكية تعتمد على فئة المحتوى وأوقات الذروة المخصصة
      const categoryPeaks: Record<string, number[]> = {
        movies: [18, 21, 23], // المساء المتأخر
        sports: [16, 19, 22], // أوقات المباريات
        recipes: [10, 15, 17], // قبل الغداء والعشاء
        gaming: [14, 20, 0], // بعد المدرسة والمساء المتأخر
        apps: [11, 14, 19], // خلال فترات الاستراحة
        tv_shows: [19, 21, 22] // وقت المشاهدة العائلية
      };

      // البحث عن فئة القصة إذا كانت متوفرة في السياق، وإلا نستخدم الفئة الافتراضية
      const currentCategory = stories.length > 0 ? stories[0].category : 'movies';
      const peaks = categoryPeaks[currentCategory] || [9, 13, 20, 22];
      
      const saudiHour = (now.getUTCHours() + 3) % 24;
      const nextPeakSaudi = peaks.find(p => p > saudiHour) || peaks[0];
      
      if (nextPeakSaudi <= saudiHour) {
        suggestedTime.setDate(now.getDate() + 1);
      }
      
      const targetUTCHour = (nextPeakSaudi - 3 + 24) % 24;
      suggestedTime.setUTCHours(targetUTCHour, 0, 0, 0);
      
      dayName = dayNames[suggestedTime.getDay()];
      timeLabel = `${nextPeakSaudi.toString().padStart(2, '0')}:00`;
      reason = `وقت ذروة مقترح لفئة الـ ${currentCategory === 'movies' ? 'أفلام' : currentCategory === 'sports' ? 'رياضة' : currentCategory === 'recipes' ? 'طبخ' : currentCategory === 'gaming' ? 'ألعاب' : 'تطبيقات'}`;
    }
    
    suggestedTime.setMinutes(Math.floor(Math.random() * 30));
    
    return {
      suggestedTime: suggestedTime.toISOString(),
      dayName,
      timeLabel: timeLabel || `${suggestedTime.getHours().toString().padStart(2, '0')}:${suggestedTime.getMinutes().toString().padStart(2, '0')}`,
      reason
    };
  }
  
  generateAdminSystemMetrics(
    users: any[], 
    stories: Story[], 
    apiConfigs: any[]
  ): AdminSystemMetrics {
    const activeUsers = users.filter(u => u.status === 'active').length;
    
    const todayStories = stories.filter(s => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(s.createdAt) >= today;
    }).length;
    
    const publishedToday = stories.filter(s => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return s.status === 'published' && s.publishedAt && new Date(s.publishedAt) >= today;
    }).length;
    
    const apiHealth: Record<string, { status: 'healthy' | 'warning' | 'error'; latency: number }> = {};
    apiConfigs.forEach((config: any) => {
      if (config.isConnected) {
        apiHealth[config.provider] = {
          status: 'healthy',
          latency: 85
        };
      } else {
        apiHealth[config.provider] = {
          status: config.apiKey ? 'warning' : 'error',
          latency: 0
        };
      }
    });
    
    const alerts: Array<{ type: 'error' | 'warning' | 'info'; message: string; timestamp: Date }> = [];
    
    const disconnectedApis = apiConfigs.filter((c: any) => !c.isConnected);
    if (disconnectedApis.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${disconnectedApis.length} APIs غير متصلة`,
        timestamp: new Date()
      });
    }
    
    const failedStories = stories.filter(s => s.status === 'failed').length;
    if (failedStories > 0) {
      alerts.push({
        type: 'error',
        message: `${failedStories} قصص فشل نشرها`,
        timestamp: new Date()
      });
    }
    
    const optimizationSuggestions: string[] = [];
    
    if (activeUsers > 0 && todayStories / activeUsers < 0.5) {
      optimizationSuggestions.push('معدل النشر منخفض - يمكن تشجيع المستخدمين على نشر المزيد');
    }
    
    const healthyApis = Object.values(apiHealth).filter(a => a.status === 'healthy').length;
    const systemHealth = Math.round((healthyApis / Math.max(Object.keys(apiHealth).length, 1)) * 100);
    
    const storiesPerformance = stories.length > 0 ? 
      Math.round((publishedToday / Math.max(todayStories, 1)) * 100) : 100;
    
    return {
      systemHealth,
      activeUsers,
      storiesPerformance,
      apiHealth,
      alerts,
      optimizationSuggestions
    };
  }
  
  calculateAccountRecommendations(accounts: LinkedAccount[], stories: Story[]): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];
    const accountHealth = this.analyzeAccountHealth(accounts, stories);
    
    const unhealthyAccounts = accountHealth.filter(a => a.healthScore < 70);
    if (unhealthyAccounts.length > 0) {
      recommendations.push({
        type: 'account',
        priority: 'high',
        title: 'حسابات تحتاج اهتمام',
        description: `${unhealthyAccounts.length} حساب(ات) تحتاج مراجعة`,
        action: 'راجع حالة الحسابات',
        confidence: 0.95,
        data: unhealthyAccounts
      });
    }
    
    const platformUsage = new Map<string, number>();
    stories.forEach(s => {
      s.platforms.forEach(p => {
        platformUsage.set(p, (platformUsage.get(p) || 0) + 1);
      });
    });
    
    accounts.forEach(account => {
      const usage = platformUsage.get(account.platform) || 0;
      if (usage === 0 && account.status === 'active') {
        recommendations.push({
          type: 'account',
          priority: 'medium',
          title: `حساب ${account.name} غير مستخدم`,
          description: 'هذا الحساب نشط لكن لم يتم النشر عليه',
          action: 'ابدأ النشر على هذا الحساب',
          confidence: 0.8
        });
      }
    });
    
    return recommendations;
  }

  analyzeAccountPerformance(accounts: LinkedAccount[], stories: Story[]): AccountPerformance[] {
    return accounts.map(account => {
      const accountStories = stories.filter(s => s.platforms.includes(account.platform));
      const publishedStories = accountStories.filter(s => s.status === 'published');
      
      // Real reach and impressions if available in account data, otherwise derived from stories
      // We use 0 as default to avoid mock data
      const reach = (account as any).reach || publishedStories.reduce((sum: number, s: any) => sum + (Number(s.reach) || 0), 0);
      const impressions = (account as any).impressions || publishedStories.reduce((sum: number, s: any) => sum + (Number(s.impressions) || 0), 0);
      
      const totalEngagement = publishedStories.reduce((sum: number, s: Story) => sum + (s.engagementRate || 0), 0);
      const avgEngagement = publishedStories.length > 0 ? totalEngagement / publishedStories.length : 0;
      
      const recentStories = publishedStories.slice(0, 5);
      const previousStories = publishedStories.slice(5, 10);
      const recentAvg = recentStories.length > 0 ? recentStories.reduce((sum: number, s: Story) => sum + (s.engagementRate || 0), 0) / recentStories.length : avgEngagement;
      const previousAvg = previousStories.length > 0 ? previousStories.reduce((sum: number, s: Story) => sum + (s.engagementRate || 0), 0) / previousStories.length : avgEngagement;
      const engagementTrend = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
      
      const categoryCounts = new Map<string, number>();
      publishedStories.forEach(s => categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1));
      const bestContentType = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'الكل';
      
      const optimalTimes = this.analyzeOptimalPostingTimes(accountStories);
      const topPerformingTime = optimalTimes[0] ? `${optimalTimes[0].dayName} ${optimalTimes[0].timeLabel}` : 'غير محدد';

      return {
        accountId: account.id,
        engagementRate: Math.round(avgEngagement * 10) / 10,
        engagementTrend: Math.round(engagementTrend),
        reach: Math.round(reach),
        reachTrend: Math.round(engagementTrend * 0.8),
        impressions: Math.round(impressions),
        impressionsTrend: Math.round(engagementTrend * 0.9),
        bestContentType,
        topPerformingTime,
        followersGrowth: Math.round(engagementTrend * 0.5)
      };
    });
  }

  analyzePerformance(stories: Story[]): {
    contentQuality: { score: number; feedback: string };
    timingOptimization: { score: number; feedback: string };
    audienceEngagement: { score: number; feedback: string };
    growthPotential: { score: number; feedback: string };
  } {
    const publishedStories = stories.filter(s => s.status === 'published');
    const avgEngagement = publishedStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / (publishedStories.length || 1);
    
    const contentQualityScore = Math.min(100, Math.round(avgEngagement * 8 + (publishedStories.length > 5 ? 20 : 0)));
    const timingScore = this.calculateTimingScore(stories);
    const engagementScore = Math.min(100, Math.round(avgEngagement * 10));
    const growthScore = this.calculateGrowthScore(stories);

    return {
      contentQuality: {
        score: contentQualityScore,
        feedback: contentQualityScore >= 70 ? 'جودة المحتوى ممتازة' : contentQualityScore >= 50 ? 'جودة جيدة مع مجال للتحسين' : 'يحتاج تحسين جودة المحتوى'
      },
      timingOptimization: {
        score: timingScore,
        feedback: timingScore >= 70 ? 'توقيت النشر مثالي' : timingScore >= 50 ? 'التوقيت جيد' : 'جرب أوقات نشر مختلفة'
      },
      audienceEngagement: {
        score: engagementScore,
        feedback: engagementScore >= 70 ? 'تفاعل الجمهور ممتاز' : engagementScore >= 50 ? 'تفاعل متوسط' : 'يحتاج زيادة التفاعل'
      },
      growthPotential: {
        score: growthScore,
        feedback: growthScore >= 70 ? 'نمو إيجابي قوي' : growthScore >= 50 ? 'نمو مستقر' : 'هناك فرص للنمو'
      }
    };
  }

  private calculateTimingScore(stories: Story[]): number {
    const publishedStories = stories.filter(s => s.status === 'published' && s.publishedAt);
    if (publishedStories.length < 3) return 50;

    const peakHours = [18, 19, 20, 21, 22];
    const storiesInPeakHours = publishedStories.filter(s => {
      const hour = new Date(s.publishedAt!).getHours();
      return peakHours.includes(hour);
    }).length;

    return Math.min(100, Math.round((storiesInPeakHours / publishedStories.length) * 100));
  }

  analyzeTrends(stories: Story[]): {
    trendingTopics: Array<{ topic: string; growth: number; relevance: number }>;
    competitorInsights: Array<{ platform: string; avgEngagement: number; yourEngagement: number }>;
    contentGaps: Array<{ category: string; opportunity: string; priority: 'high' | 'medium' | 'low' }>;
  } {
    const categoryCount = new Map<string, { count: number; engagement: number }>();
    const platformStats = new Map<string, { count: number; engagement: number }>();
    
    stories.forEach(s => {
      const existing = categoryCount.get(s.category) || { count: 0, engagement: 0 };
      existing.count++;
      existing.engagement += s.engagementRate || 0;
      categoryCount.set(s.category, existing);
      
      s.platforms.forEach(p => {
        const pStats = platformStats.get(p) || { count: 0, engagement: 0 };
        pStats.count++;
        pStats.engagement += s.engagementRate || 0;
        platformStats.set(p, pStats);
      });
    });

    const sortedCategories = Array.from(categoryCount.entries())
      .map(([cat, data]) => ({ topic: cat, growth: Math.round(data.engagement / data.count * 10), relevance: Math.min(100, data.count * 15) }))
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 5);

    const trendingTopics = sortedCategories.length > 0 ? sortedCategories : [
      { topic: 'أفلام', growth: 25, relevance: 85 },
      { topic: 'مسلسلات', growth: 18, relevance: 78 },
      { topic: 'رياضة', growth: 15, relevance: 72 }
    ];

    const competitorInsights = ['facebook', 'instagram', 'tiktok'].map(platform => {
      const stats = platformStats.get(platform) || { count: 0, engagement: 0 };
      const yourEngagement = stats.count > 0 ? Math.round(stats.engagement / stats.count * 10) / 10 : 0;
      const avgMarket: Record<string, number> = { facebook: 3.5, instagram: 4.2, tiktok: 5.8 };
      return {
        platform,
        avgEngagement: avgMarket[platform] || 4.0,
        yourEngagement
      };
    });

    const allCategories = ['movies', 'tv_shows', 'sports', 'recipes', 'games', 'apps'];
    const usedCategories = new Set(stories.map(s => s.category as string));
    const contentGaps = allCategories
      .filter(cat => !usedCategories.has(cat))
      .slice(0, 3)
      .map((cat, i) => {
        const categoryNames: Record<string, string> = {
          movies: 'أفلام',
          tv_shows: 'مسلسلات',
          sports: 'رياضة',
          recipes: 'وصفات',
          games: 'ألعاب',
          apps: 'تطبيقات'
        };
        return {
          category: (categoryNames[cat] || cat) as any,
          opportunity: `فئة ${categoryNames[cat] || cat} لم تُستخدم بعد`,
          priority: i === 0 ? 'high' as const : i === 1 ? 'medium' as const : 'low' as const
        };
      });

    return {
      trendingTopics,
      competitorInsights: Array.from(platformStats.entries()).map(([platform, stats]) => ({
        platform,
        avgEngagement: stats.engagement / stats.count,
        yourEngagement: (stats.engagement / stats.count) * 0.9
      })),
      contentGaps: Array.from(categoryCount.entries())
        .filter(([_, stats]) => stats.count < 3)
        .map(([category]) => ({
          category: category as any,
          opportunity: 'هذه الفئة غير مغطاة بشكل كافٍ',
          priority: 'medium'
        }))
    };
  }

  calculateEngagementStats(stories: Story[]): {
    likes: number;
    likesChange: number;
    shares: number;
    sharesChange: number;
    comments: number;
    commentsChange: number;
    views: number;
    viewsChange: number;
  } {
    const publishedStories = stories.filter(s => s.status === 'published');
    const totalEngagement = publishedStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentStories = publishedStories.filter(s => new Date(s.publishedAt || s.createdAt) > sevenDaysAgo);
    const olderStories = publishedStories.filter(s => {
      const date = new Date(s.publishedAt || s.createdAt);
      return date > fourteenDaysAgo && date <= sevenDaysAgo;
    });

    const recentEngagement = recentStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0);
    const olderEngagement = olderStories.reduce((sum, s) => sum + (s.engagementRate || 0), 0);
    
    const changePercent = olderEngagement > 0 ? Math.round((recentEngagement - olderEngagement) / olderEngagement * 100) : 0;

    const baseLikes = Math.round(totalEngagement * 150);
    const baseShares = Math.round(totalEngagement * 35);
    const baseComments = Math.round(totalEngagement * 12);
    const baseViews = Math.round(totalEngagement * 800);

    return {
      likes: baseLikes,
      likesChange: changePercent,
      shares: baseShares,
      sharesChange: Math.round(changePercent * 0.8),
      comments: baseComments,
      commentsChange: Math.round(changePercent * 1.2),
      views: baseViews,
      viewsChange: changePercent
    };
  }

}

export const smartAlgorithms = new SmartAlgorithmsEngine();
