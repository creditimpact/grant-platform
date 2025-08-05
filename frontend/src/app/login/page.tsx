'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormInput from '@/components/FormInput';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold text-center">Apply for Business Grants</h1>
      <p className="text-center text-gray-600">Sign in to continue your application and track progress.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="We'll send updates to this address"
        />
        <FormInput
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          tooltip="Minimum 8 characters"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Login
        </button>
      </form>
    </div>
  );
}
