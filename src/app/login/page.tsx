import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Login } from "@/components/login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/settings" : "/dashboard");
  return <Login />;
}
