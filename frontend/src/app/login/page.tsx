// Redirect /login to /dashboard
import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/dashboard');
}
