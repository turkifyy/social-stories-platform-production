import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertTriangle, CheckCircle } from 'lucide-react';

import { DailyStorySettings } from '@shared/schema';

export default function DailyStories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishTime, setPublishTime] = useState('09:00');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [isEnabled, setIsEnabled] = useState(true);
  const [videoQuality, setVideoQuality] = useState('hd');
  const [publishInterval, setPublishInterval] = useState('5');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['facebook']);
  const [selectedCategories, setSelectedCategories] = useState(['movies', 'tv_shows', 'sports', 'recipes', 'gaming', 'apps']);

  const { data: settings, isLoading } = useQuery<DailyStorySettings>({
    queryKey: ['/api/stories/daily-settings'],
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings && typeof settings === 'object') {
      setIsEnabled(settings.isEnabled ?? true);
      setPublishTime(settings.publishTime ?? '09:00');
      setTimezone(settings.timezone ?? 'Asia/Riyadh');
      setVideoQuality(settings.videoQuality ?? 'hd');
      setPublishInterval(settings.publishInterval?.toString() ?? '5');
      setSelectedPlatforms(settings.platforms ?? ['facebook']);
      setSelectedCategories(settings.categories ?? ['movies', 'tv_shows', 'sports', 'recipes', 'gaming', 'apps']);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stories/daily-settings', {
        isEnabled,
        publishTime,
        timezone,
        platforms: selectedPlatforms,
        categories: selectedCategories,
        videoQuality,
        publishInterval: parseInt(publishInterval),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stories/daily-settings'] });
      toast({
        title: 'Settings Saved',
        description: 'Daily story settings updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stories/auto/generate-daily', {
        publishTime,
        platforms: selectedPlatforms,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Stories Generated',
        description: `Created ${data.storiesGenerated} stories successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stories/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/platforms'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const preGenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stories/auto/pre-generate-videos', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Pre-generation Started',
        description: 'Videos will be generated 2 hours before publish time',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Daily Stories Automation</h1>
        <p className="text-muted-foreground">Configure automatic daily story generation and publishing</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Stories will automatically generate at {publishTime} {timezone} with 2-hour pre-generation buffer
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
          <CardDescription>Configure when and how stories are generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Daily Automation</Label>
            <Switch
              id="enabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              data-testid="switch-enable-automation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publishTime">Publish Time (Saudi Time)</Label>
              <div className="flex gap-2">
                <Input
                  id="publishTime"
                  type="time"
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                  className="flex-1"
                  data-testid="input-publish-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone" data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Riyadh">Asia/Riyadh (UTC+3)</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                  <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-4">
              {['facebook', 'instagram', 'tiktok'].map((platform) => (
                <button
                  key={platform}
                  onClick={() => {
                    setSelectedPlatforms(prev =>
                      prev.includes(platform)
                        ? prev.filter(p => p !== platform)
                        : [...prev, platform]
                    );
                  }}
                  className={`px-4 py-2 rounded border capitalize ${
                    selectedPlatforms.includes(platform)
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300'
                  }`}
                  data-testid={`button-platform-${platform}`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Story Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {['movies', 'tv_shows', 'sports', 'recipes', 'gaming', 'apps'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategories(prev =>
                      prev.includes(cat)
                        ? prev.filter(c => c !== cat)
                        : [...prev, cat]
                    );
                  }}
                  className={`px-3 py-2 rounded border text-sm capitalize ${
                    selectedCategories.includes(cat)
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300'
                  }`}
                  data-testid={`button-category-${cat}`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quality">Video Quality</Label>
              <Select value={videoQuality} onValueChange={setVideoQuality}>
                <SelectTrigger id="quality" data-testid="select-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sd">SD (480p)</SelectItem>
                  <SelectItem value="hd">HD (1080p)</SelectItem>
                  <SelectItem value="4k">4K (2160p)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">Publish Interval (minutes)</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="60"
                value={publishInterval}
                onChange={(e) => setPublishInterval(e.target.value)}
                data-testid="input-publish-interval"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-test-generation"
            >
              {testMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test Story Generation
            </Button>
            <Button
              variant="secondary"
              onClick={() => preGenerateMutation.mutate()}
              disabled={preGenerateMutation.isPending}
              data-testid="button-pre-generate"
            >
              {preGenerateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Pre-generate Videos Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {settings && typeof settings === 'object' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Current Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Status:</span>
              <span className="ml-2">{(settings as any).isEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              <span className="font-semibold">Publish Time:</span>
              <span className="ml-2">{(settings as any).publishTime}</span>
            </div>
            <div>
              <span className="font-semibold">Platforms:</span>
              <span className="ml-2">{((settings as any).platforms || []).join(', ')}</span>
            </div>
            <div>
              <span className="font-semibold">Categories:</span>
              <span className="ml-2">{((settings as any).categories || []).length} selected</span>
            </div>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
