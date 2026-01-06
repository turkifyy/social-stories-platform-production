import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { YouTubeMusicSearchResult } from "@shared/schema";
import { Link } from "wouter";

interface MusicSearchProps {
  onSelectMusic: (music: YouTubeMusicSearchResult) => void;
  selectedMusic?: YouTubeMusicSearchResult | null;
}

export function MusicSearch({ onSelectMusic, selectedMusic }: MusicSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeMusicSearchResult[]>([]);
  const { toast } = useToast();

  const { data: apiConfigs } = useQuery<Array<{provider: string; isConnected: boolean}>>({
    queryKey: ['/api/api-configs/status'],
  });

  const youtubeConfig = apiConfigs?.find(c => c.provider === 'youtube');
  const isYouTubeConnected = youtubeConfig?.isConnected || false;

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/music/search", { query, limit: 6 });
      return await response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        toast({
          title: "لا توجد نتائج",
          description: "لم يتم العثور على موسيقى. حاول بحث آخر.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال نص البحث",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <i className="fab fa-youtube text-red-600"></i>
          إضافة موسيقى
        </CardTitle>
        <CardDescription>ابحث عن موسيقى من YouTube لإضافتها إلى قصتك</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isYouTubeConnected && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <i className="fas fa-exclamation-triangle ml-1"></i>
              يجب إعداد YouTube API في لوحة الإدارة أولاً للبحث عن الموسيقى.
              <Link href="/admin" className="underline hover:no-underline mr-1">
                انتقل إلى لوحة الإدارة →
              </Link>
            </p>
          </div>
        )}

        {selectedMusic && (
          <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {selectedMusic.thumbnail && (
                  <img
                    src={selectedMusic.thumbnail}
                    alt={selectedMusic.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedMusic.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedMusic.artist}</p>
                  <p className="text-xs text-muted-foreground">{formatDuration(selectedMusic.duration)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectMusic(null as any)}
                data-testid="button-remove-music"
              >
                <i className="fas fa-times"></i>
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="music-search">ابحث عن موسيقى</Label>
          <div className="flex gap-2">
            <Input
              id="music-search"
              placeholder="اسم الأغنية أو الفنان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={!isYouTubeConnected || searchMutation.isPending}
              data-testid="input-music-search"
            />
            <Button
              onClick={handleSearch}
              disabled={!isYouTubeConnected || searchMutation.isPending}
              data-testid="button-search-music"
            >
              {searchMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin ml-2"></i>
                  جاري البحث...
                </>
              ) : (
                <>
                  <i className="fas fa-search ml-2"></i>
                  بحث
                </>
              )}
            </Button>
          </div>
        </div>

        {searchMutation.isPending && (
          <div className="grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {searchResults.length > 0 && !searchMutation.isPending && (
          <div className="space-y-2">
            <Label>النتائج ({searchResults.length})</Label>
            <div className="grid gap-2 max-h-80 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.videoId}
                  onClick={() => {
                    onSelectMusic(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all hover-elevate text-right w-full ${
                    selectedMusic?.videoId === result.videoId
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary"
                  }`}
                  data-testid={`button-music-${result.videoId}`}
                >
                  {result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-medium text-sm truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        <i className="fab fa-youtube ml-1"></i>
                        YouTube
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDuration(result.duration)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
