import { redirect } from "next/navigation";

/** Profile is edited from the dashboard (avatar → modal). This keeps old links working. */
export default function ProfilePage() {
  redirect("/dashboard");
}
