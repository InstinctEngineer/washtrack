import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortalPending() {
  const navigate = useNavigate();
  const { signOut, portalStatus } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
          <CardDescription>Thanks for signing up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your account is being reviewed by our team. Once approved, you'll be able to sign in
            and request access to your locations' work history.
          </p>
          {portalStatus?.work_location && (
            <p className="text-xs text-muted-foreground">
              Submitted as <span className="font-medium">{portalStatus.first_name} {portalStatus.last_name}</span>
              {' · '}{portalStatus.work_location}
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => { await signOut(); navigate('/portal/login', { replace: true }); }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
