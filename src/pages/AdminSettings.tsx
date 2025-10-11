import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentCutoff, getLastSunday, getDaysUntilNextCutoff, getCutoffStatusColor, extendCutoffByDays, updateCutoffDate } from '@/lib/cutoff';
import { SystemSettingsAudit } from '@/types/database';

type AuditTrailItem = SystemSettingsAudit & { 
  user?: { 
    id: string; 
    name: string; 
  } 
};

export default function AdminSettings() {
  const { user } = useAuth();
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditTrailItem[]>([]);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cutoff date
      const cutoff = await getCurrentCutoff();
      setCutoffDate(cutoff);

      // Fetch audit trail
      const { data: auditData, error: auditError } = await supabase
        .from('system_settings_audit')
        .select('*')
        .eq('setting_key', 'entry_cutoff_date')
        .order('changed_at', { ascending: false })
        .limit(20);

      if (auditError) throw auditError;

      // Fetch user names for audit trail
      if (auditData && auditData.length > 0) {
        const userIds = auditData.map(a => a.changed_by).filter(Boolean);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', userIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const enrichedAudit = auditData.map(audit => ({
          ...audit,
          user: audit.changed_by ? usersMap.get(audit.changed_by) : undefined,
        }));
        setAuditTrail(enrichedAudit);
      }

      // Fetch system stats
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: vehiclesCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setActiveUsers(usersCount || 0);
      setActiveVehicles(vehiclesCount || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExtendCutoff = async () => {
    if (!user || !cutoffDate) return;

    try {
      const result = await extendCutoffByDays(7, user.id, 'Extended by 1 week');
      
      if (result.success && result.newDate) {
        toast({
          title: 'Success',
          description: `Cutoff date extended to ${format(result.newDate, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to extend cutoff');
      }
    } catch (error) {
      console.error('Error extending cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to extend cutoff date',
        variant: 'destructive',
      });
    }
    setShowExtendDialog(false);
  };

  const handleResetToLastSunday = async () => {
    if (!user) return;

    try {
      const lastSunday = getLastSunday();
      const result = await updateCutoffDate(lastSunday, user.id, 'Reset to last Sunday');
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Cutoff date reset to ${format(lastSunday, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to reset cutoff');
      }
    } catch (error) {
      console.error('Error resetting cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset cutoff date',
        variant: 'destructive',
      });
    }
    setShowResetDialog(false);
  };

  const handleManualDateSet = async () => {
    if (!user || !manualDate) return;

    try {
      // Set time to 23:59:59
      const dateWithTime = new Date(manualDate);
      dateWithTime.setHours(23, 59, 59, 999);

      const result = await updateCutoffDate(dateWithTime, user.id, 'Manual date selection');
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Cutoff date set to ${format(dateWithTime, 'PPP p')}`,
        });
        await fetchData();
      } else {
        throw new Error(result.error || 'Failed to set cutoff');
      }
    } catch (error) {
      console.error('Error setting cutoff:', error);
      toast({
        title: 'Error',
        description: 'Failed to set cutoff date',
        variant: 'destructive',
      });
    }
    setShowManualDialog(false);
    setManualDate(undefined);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  const statusColor = cutoffDate ? getCutoffStatusColor(cutoffDate) : 'red';
  const daysUntilNextCutoff = getDaysUntilNextCutoff();

  const StatusIcon = statusColor === 'green' ? CheckCircle : statusColor === 'yellow' ? AlertTriangle : XCircle;
  const statusColorClass = statusColor === 'green' ? 'text-green-600' : statusColor === 'yellow' ? 'text-yellow-600' : 'text-red-600';
  const statusBgClass = statusColor === 'green' ? 'bg-green-50' : statusColor === 'yellow' ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage entry cutoff dates and system configuration
          </p>
        </div>

        {/* System Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Active Employees</div>
                <div className="text-2xl font-bold mt-1">{activeUsers}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Active Vehicles</div>
                <div className="text-2xl font-bold mt-1">{activeVehicles}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Days Until Next Cutoff</div>
                <div className="text-2xl font-bold mt-1">{daysUntilNextCutoff}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cutoff Date Section */}
        <Card className={statusBgClass}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Entry Cutoff Date
                </CardTitle>
                <CardDescription className="mt-2">
                  Employees cannot enter washes before this date
                </CardDescription>
              </div>
              <StatusIcon className={`h-8 w-8 ${statusColorClass}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {cutoffDate && (
              <div className="space-y-4">
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold text-lg">
                      {format(cutoffDate, 'EEEE, MMMM d, yyyy')} at {format(cutoffDate, 'h:mm a')}
                    </div>
                    <div className="text-sm mt-1">
                      {statusColor === 'green' && 'Entry period is open'}
                      {statusColor === 'yellow' && 'Entry deadline approaching'}
                      {statusColor === 'red' && 'Entry period is closed'}
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={() => setShowExtendDialog(true)}>
                    Extend Cutoff by 1 Week
                  </Button>
                  <Button variant="outline" onClick={() => setShowResetDialog(true)}>
                    Reset to Last Sunday
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Set Custom Date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={manualDate}
                        onSelect={(date) => {
                          setManualDate(date);
                          if (date) {
                            setShowManualDialog(true);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
            <CardDescription>Recent cutoff date changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Changed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditTrail.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No changes recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditTrail.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell>{audit.user?.name || 'System'}</TableCell>
                        <TableCell>
                          {audit.old_value ? format(new Date(audit.old_value), 'PPP p') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(audit.new_value), 'PPP p')}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {audit.change_reason || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(audit.changed_at), 'PPP p')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extend Confirmation Dialog */}
      <AlertDialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend Entry Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add 7 days to the current cutoff date. Employees will be able to edit data
              from {cutoffDate && format(cutoffDate, 'PPP')} to{' '}
              {cutoffDate && format(new Date(cutoffDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'PPP')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtendCutoff}>
              Extend Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Last Sunday?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the cutoff to the end of the previous week. Employees can enter washes for the 7-day period ending on{' '}
              {format(getLastSunday(), 'EEEE, MMMM d, yyyy')} at{' '}
              {format(getLastSunday(), 'h:mm a')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToLastSunday}>
              Reset Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Date Confirmation Dialog */}
      <AlertDialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Custom Cutoff Date?</AlertDialogTitle>
            <AlertDialogDescription>
              {manualDate && (
                <>
                  This will set the cutoff date to {format(manualDate, 'EEEE, MMMM d, yyyy')} at 11:59 PM.
                  Employees will be able to enter washes for 7 days leading up to this date.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setManualDate(undefined)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleManualDateSet}>
              Set Cutoff
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
