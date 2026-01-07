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
  Building2,
  MessageSquare,
  Wrench,
  Package
} from 'lucide-react';
import { useState } from 'react';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import esAndDLogo from '@/assets/es-d-logo.png';
import { UserRole } from '@/types/database';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { userProfile, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { unreadCount } = useUnreadMessageCount();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!userProfile || !userRole) return [];

    const navItems: Array<{ label: string; icon: any; path: string; section?: string; badge?: number }> = [];

    // Dashboard section - show all dashboards user has access to
    if (hasRoleOrHigher(userRole, 'employee' as UserRole)) {
      navItems.push({ 
        label: 'Employee Dashboard', 
        icon: UserCircle, 
        path: '/employee/dashboard',
        section: 'Dashboards'
      });
    }

    // Manager Dashboard temporarily hidden - uncomment when ready
    // if (hasRoleOrHigher(userRole, 'manager' as UserRole)) {
    //   navItems.push({ 
    //     label: 'Manager Dashboard', 
    //     icon: Briefcase, 
    //     path: '/manager/dashboard',
    //     section: 'Dashboards'
    //   });
    // }

    if (hasRoleOrHigher(userRole, 'finance' as UserRole)) {
      navItems.push({ 
        label: 'Reports & Tables', 
        icon: DollarSign, 
        path: '/finance/dashboard',
        section: 'Dashboards'
      });
      navItems.push({ 
        label: 'Messages', 
        icon: MessageSquare, 
        path: '/finance/messages',
        section: 'Dashboards',
        badge: unreadCount > 0 ? unreadCount : undefined
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
        { label: 'Work Types', icon: Wrench, path: '/admin/work-types', section: 'Administration' },
        { label: 'Rate Card', icon: DollarSign, path: '/admin/rates', section: 'Administration' },
        { label: 'Work Items', icon: Package, path: '/admin/items', section: 'Administration' },
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
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2d8cc4] flex items-center justify-center shadow-md transition-transform hover:scale-110">
                <span className="text-white font-bold text-sm">WT</span>
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
          border-r transition-transform lg:translate-x-0 relative
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ 
          backgroundColor: 'hsl(var(--sidebar-background))',
          borderColor: 'hsl(var(--sidebar-border))',
          color: 'hsl(var(--sidebar-foreground))'
        }}
        >
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2d8cc4] via-[#1e3a5f] to-[#2d8cc4]" />
          
          <nav className="flex flex-col gap-4 p-4 pl-5">
            {Object.entries(groupedNavItems).map(([section, items]) => (
              <div key={section} className="space-y-1">
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>
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
                      `}
                      style={isActive 
                        ? { 
                            backgroundColor: 'hsl(var(--sidebar-primary))',
                            color: 'hsl(var(--sidebar-primary-foreground))'
                          }
                        : { 
                            color: 'hsl(var(--sidebar-foreground))'
                          }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'hsl(var(--sidebar-accent))';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                      {item.badge && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </Badge>
                      )}
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
