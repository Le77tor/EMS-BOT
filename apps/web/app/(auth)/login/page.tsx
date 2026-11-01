'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signIn } from 'next-auth/react';
import { TrendingUp, LogOut, AlertCircle } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BlacklistRemovalModal } from '@/components/blacklist-removal-modal';
import { EmploymentModal } from '@/components/employment-modal';

function LoginContent() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blacklistModalOpen, setBlacklistModalOpen] = useState(false);
  const [employmentModalOpen, setEmploymentModalOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    
    const error = searchParams.get('error');
    if (error === 'NotOnServer') {
      setErrorMessage('Вы не состоите на Discord сервере');
    } else if (error === 'NoEmsRole') {
      setErrorMessage('У вас нет роли EMS');
    } else if (error === 'AccessDenied') {
      setErrorMessage('Доступ запрещён');
    } else if (error === 'not_ems_member') {
      setErrorMessage('Вы не сотрудник EMS');
    } else if (error) {
      setErrorMessage('Ошибка авторизации');
    }
  }, [searchParams]);

  const handleDiscordLogin = async () => {
    setErrorMessage(null);
    await signIn('discord', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      {/* 🔴 ОШИБКА */}
      {errorMessage && (
        <Card className="w-full max-w-md border-red-500/50 bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-100">
                  {errorMessage}
                </p>
                <p className="text-xs text-red-300 mt-1">
                  У вас нет доступа к системе управления. Получите роль EMS на Discord сервере.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Login Card */}
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto mb-4">
            <div className="bg-primary/10 p-4 rounded-2xl">
              <svg 
                className="w-12 h-12 text-primary" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86-.93-6-4.85-6-8V8.3l6-3 6 3V12c0 3.15-2.14 7.07-6 8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            Majestic CMS
          </CardTitle>
          <CardDescription className="text-base">
            Войдите через Discord для доступа к системе управления
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleDiscordLogin}
            className="w-full h-12 text-base font-semibold" 
            size="lg"
          >
            <svg 
              className="mr-3 h-6 w-6" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Войти через Discord
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Безопасный вход
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Используя Discord OAuth 2.0
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>Зашифровано</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>Безопасно</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Access Buttons - без текста, кнопки выше */}
      <div className="w-full max-w-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Вынесение из ЧС */}
          <button
            onClick={() => setBlacklistModalOpen(true)}
            className="group"
          >
            <Card className="border hover:border-red-500/50 hover:bg-red-500/5 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-red-500/10">
                    <LogOut className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Вынесение из ЧС
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Подать заявление
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          {/* Трудоустройство */}
          <button
            onClick={() => setEmploymentModalOpen(true)}
            className="group"
          >
            <Card className="border hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Трудоустройство
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Подать заявление
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>

      {/* Модалы */}
      <BlacklistRemovalModal 
        open={blacklistModalOpen} 
        onOpenChange={setBlacklistModalOpen} 
      />
      <EmploymentModal 
        open={employmentModalOpen} 
        onOpenChange={setEmploymentModalOpen} 
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
