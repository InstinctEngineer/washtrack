import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, MapPin, User as UserIcon, MessageSquare } from 'lucide-react';
import esAndDLogo from '@/assets/es-d-logo.png';
import { ErrorReportButton } from '@/components/ErrorReportButton';

interface Props { title?: string; children: React.ReactNode; }

export const PortalShell = ({ title, children }: Props) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <Link to="/portal/dashboard" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2d8cc4] flex items-center justify-center text-white text-sm shadow-md transition-transform hover:scale-110">
              WT
            </div>
            <span className="hidden sm:inline font-bold text-lg bg-gradient-to-r from-[#1e3a5f] to-[#2d8cc4] bg-clip-text text-transparent">
              WashTrack
            </span>
            <span className="hidden sm:inline text-sm text-muted-foreground">for</span>
            <img
              src={esAndDLogo}
              alt="ES&D Services Inc."
              className="hidden sm:block h-10 w-auto object-contain transition-transform hover:scale-110"
            />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/dashboard"><MapPin className="h-4 w-4 mr-1" /> Locations</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/messages"><MessageSquare className="h-4 w-4 mr-1" /> Messages</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/request-access"><UserIcon className="h-4 w-4 mr-1" /> Request Access</Link>
            </Button>
            <ErrorReportButton />
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
