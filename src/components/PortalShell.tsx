import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, MapPin, User as UserIcon } from 'lucide-react';

interface Props { title?: string; children: React.ReactNode; }

export const PortalShell = ({ title, children }: Props) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <Link to="/portal/dashboard" className="flex items-center gap-2 font-bold">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2d8cc4] flex items-center justify-center text-white text-sm">CP</div>
            <span className="hidden sm:inline">Client Portal</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/dashboard"><MapPin className="h-4 w-4 mr-1" /> Locations</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/request-access"><UserIcon className="h-4 w-4 mr-1" /> Request Access</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/portal/login'); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </nav>
        </div>
      </header>
      <main className="p-4 lg:p-8 max-w-6xl mx-auto">
        {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
};
