/**
 * Protected Routes Layout
 * 
 * This layout wraps all protected routes and handles authentication
 * Server-side redirects to login if not authenticated
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}

