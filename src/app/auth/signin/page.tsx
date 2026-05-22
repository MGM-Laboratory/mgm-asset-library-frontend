import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: PageProps) {
  const { callbackUrl = '/' } = await searchParams;
  // Auth.js's server-side signIn() returns a redirect response, which
  // bubbles up through Next.js's redirect handler. In mock mode the
  // middleware short-circuits before we ever reach here.
  await signIn('keycloak', { redirectTo: callbackUrl });
  redirect(callbackUrl);
}
