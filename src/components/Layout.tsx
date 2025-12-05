import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Settings, 
  LogOut, 
  Menu,
  User as UserIcon,
  DollarSign,
  Briefcase,
  UserCircle,
  Building2
} from 'lucide-react';
import { useState } from 'react';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import esAndDLogo from '@/assets/es-d-logo.png';
import { UserRole } from '@/types/database';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { userProfile, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!userProfile || !userRole) return [];

    const navItems: Array<{ label: string; icon: any; path: string; section?: string }> = [];

    // Dashboard section - show all dashboards user has access to
    if (hasRoleOrHigher(userRole, 'employee' as UserRole)) {
      navItems.push({ 
        label: 'Employee Dashboard', 
        icon: UserCircle, 
        path: '/employee/dashboard',
        section: 'Dashboards'
      });
    }

    if (hasRoleOrHigher(userRole, 'manager' as UserRole)) {
      navItems.push({ 
        label: 'Manager Dashboard', 
        icon: Briefcase, 
        path: '/manager/dashboard',
        section: 'Dashboards'
      });
    }

    if (hasRoleOrHigher(userRole, 'finance' as UserRole)) {
      navItems.push({ 
        label: 'Reports & Tables', 
        icon: DollarSign, 
        path: '/finance/dashboard',
        section: 'Dashboards'
      });
    }

    if (hasRoleOrHigher(userRole, 'admin' as UserRole)) {
      navItems.push({ 
        label: 'Admin Dashboard', 
        icon: LayoutDashboard, 
        path: '/admin/dashboard',
        section: 'Dashboards'
      });

      // Admin-only features
      navItems.push(
        { label: 'Users', icon: Users, path: '/admin/users', section: 'Administration' },
        { label: 'Clients', icon: Building2, path: '/admin/clients', section: 'Administration' },
        { label: 'Locations', icon: MapPin, path: '/admin/locations', section: 'Administration' },
        { label: 'Settings', icon: Settings, path: '/admin/settings', section: 'Administration' }
      );
    }

    return navItems;
  };

  const navItems = getNavItems();
  
  // Group nav items by section
  const groupedNavItems = navItems.reduce((acc, item) => {
    const section = item.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'finance': return 'secondary';
      case 'manager': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={esAndDLogo} 
                alt="ES&D Services Inc." 
                className="h-10 w-auto max-w-[150px] object-contain"
              />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{userProfile?.name}</span>
                  <Badge variant={getRoleBadgeVariant(userProfile?.role || '')} className="capitalize">
                    {userProfile?.role}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userProfile?.name}</p>
                    <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Side Navigation */}
        <aside className={`
          fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 
          border-r bg-card transition-transform lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <nav className="flex flex-col gap-4 p-4">
            {Object.entries(groupedNavItems).map(([section, items]) => (
              <div key={section} className="space-y-1">
                <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section}
                </h3>
                {items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                        ${isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent hover:text-accent-foreground'
                        }
                      `}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
