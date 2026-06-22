import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoleOrHigher } from '@/lib/roleUtils';
import { UserRole } from '@/types/database';
import { Briefcase, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeSwitcherProps {
  isPayroll: boolean;
}

/**
 * Top-level switcher between the Invoicing side and the Payroll side
 * of the app. Visible only to Finance, Admin, and Super Admin.
 */
export const ModeSwitcher = ({ isPayroll }: ModeSwitcherProps) => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  if (!userRole || !hasRoleOrHigher(userRole, 'finance' as UserRole)) {
    return null;
  }

  const handleSwitch = (target: 'invoicing' | 'payroll') => {
    if (target === 'payroll' && !isPayroll) {
      navigate('/payroll/dashboard');
    } else if (target === 'invoicing' && isPayroll) {
      navigate('/');
    }
  };

  return (
    <div className="hidden md:inline-flex items-center rounded-full border bg-muted/40 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => handleSwitch('invoicing')}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all',
          !isPayroll
            ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Briefcase className="h-4 w-4" />
        ES&amp;D Invoicing
      </button>
      <button
        type="button"
        onClick={() => handleSwitch('payroll')}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all',
          isPayroll
            ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Wallet className="h-4 w-4" />
        ES&amp;D Payroll
      </button>
    </div>
  );
};