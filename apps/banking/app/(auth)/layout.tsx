/**
 * Auth Routes Layout
 * 
 * note: we removed the server-side redirect here because it breaks OAuth flows
 * The redirection for authenticated users is handled in the login/register pages directly
 */

import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We just fetch user to populate cache if needed, but don't redirect here
  // because Layouts don't have access to searchParams to know if we should
  // allow the user to stay (e.g. for OAuth redirects)
  await getCurrentUser();

  return <>{children}</>;
}

