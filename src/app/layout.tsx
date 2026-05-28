import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import { fontVariables } from '@/styles/fonts';
import { QueryProvider } from '@/providers/query-provider';
import { SentryBootstrap } from '@/providers/sentry-provider';
import { PrimaryButtonGuard } from '@/providers/primary-button-guard';
import { Toaster } from '@/components/ui/toaster';
import { publicEnv } from '@/lib/env.public';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: publicEnv.NEXT_PUBLIC_APP_NAME,
    template: `%s — ${publicEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description:
    'Internal asset library for the MGM research lab. Discover, publish, request and version Unity/Unreal/agnostic assets, all in one place.',
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    type: 'website',
    title: publicEnv.NEXT_PUBLIC_APP_NAME,
    description: 'A calm, premium asset library for MGM Laboratory.',
    siteName: publicEnv.NEXT_PUBLIC_APP_NAME,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={fontVariables}>
      <body className="bg-bg font-sans text-ink antialiased">
        {/*
          Keycloak's default access-token TTL is 5 min and the backend's
          KeycloakAuthGuard verifies expiry on every request. Without polling,
          useSession() returns whatever token was minted at sign-in — every
          fetch after ~5 min of idle would 401. Refetching every 4 min (and on
          window focus) forces the Auth.js JWT callback to run the refresh
          grant ahead of expiry, keeping the in-memory session token fresh.
        */}
        <SessionProvider refetchInterval={4 * 60} refetchOnWindowFocus>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <PrimaryButtonGuard>
                <SentryBootstrap />
                {children}
                <Toaster />
              </PrimaryButtonGuard>
            </QueryProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
