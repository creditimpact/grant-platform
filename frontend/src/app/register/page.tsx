'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormInput from '@/components/FormInput';
import { useAuth } from '@/hooks/useAuth';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register({ email, password });
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Register</h1>
      <FormInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <FormInput label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Register</button>
    </form>
  );
}
