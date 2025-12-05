import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import { getUserHighestRole, getDashboardPath } from '@/lib/roleUtils';
import { useAuth } from '@/contexts/AuthContext';
import esAndDLogo from '@/assets/es-d-logo.png';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user && userRole) {
      navigate(getDashboardPath(userRole), { replace: true });
    }
  }, [user, userRole, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Fetch user's highest role from user_roles table
      const highestRole = await getUserHighestRole(data.user.id);

      if (!highestRole) {
        throw new Error('No role assigned to user');
      }

      // Redirect to dashboard based on highest role
      navigate(getDashboardPath(highestRole));
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2d8cc4] flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">WT</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-[#1e3a5f] to-[#2d8cc4] bg-clip-text text-transparent">
                WashTrack
              </span>
              <span className="text-sm text-muted-foreground">for</span>
              <img 
                src={esAndDLogo} 
                alt="ES&D Services Inc." 
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
          <CardDescription className="text-base">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
