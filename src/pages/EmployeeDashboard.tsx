import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { WeekView } from '@/components/WeekView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { WashEntryWithDetails } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { CutoffBanner } from '@/components/CutoffBanner';
import { getCurrentCutoff, canUserOverrideCutoff } from '@/lib/cutoff';

export default function EmployeeDashboard() {
  const { userProfile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<WashEntryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null);

  useEffect(() => {
    if (userProfile?.id) {
      fetchWeekEntries();
      loadCutoffDate();
    }
  }, [userProfile?.id, currentWeek]);

  const loadCutoffDate = async () => {
    const cutoff = await getCurrentCutoff();
    setCutoffDate(cutoff);
  };

  const fetchWeekEntries = async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      const { data, error } = await supabase
        .from('wash_entries')
        .select(`
          *,
          vehicle:vehicles(
            *,
            vehicle_type:vehicle_types(*),
            home_location:locations!vehicles_home_location_id_fkey(*)
          ),
          employee:users(*),
          actual_location:locations(*)
        `)
        .eq('employee_id', userProfile.id)
        .gte('wash_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('wash_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntries((data || []) as WashEntryWithDetails[]);
    } catch (error: any) {
      console.error('Error fetching wash entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wash entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddWash = async (date: Date, vehicleNumber: string, vehicleId: string) => {
    if (!userProfile?.id || !userProfile?.location_id) {
      toast({
        title: 'Error',
        description: 'Contact admin to assign your location',
        variant: 'destructive',
      });
      return;
    }

    // Check cutoff date restriction for employees
    // Employees can only enter washes for the 7-day period ending on the cutoff date
    if (cutoffDate && userProfile.role === 'employee') {
      const washDate = new Date(date);
      washDate.setHours(0, 0, 0, 0);
      
      const cutoffDateOnly = new Date(cutoffDate);
      cutoffDateOnly.setHours(0, 0, 0, 0);
      
      // Calculate start of allowed period (6 days before cutoff, making 7 days total)
      const allowedStartDate = new Date(cutoffDateOnly);
      allowedStartDate.setDate(cutoffDateOnly.getDate() - 6);
      
      if (washDate < allowedStartDate || washDate > cutoffDateOnly) {
        toast({
          title: 'Entry Blocked',
          description: 'Can only enter washes for the current week period. Contact your manager.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      // If vehicleId is empty, we need to look up the vehicle by number
      let finalVehicleId = vehicleId;
      
      if (!finalVehicleId) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id')
          .eq('vehicle_number', vehicleNumber)
          .eq('is_active', true)
          .single();

        if (vehicleError || !vehicleData) {
          toast({
            title: 'Vehicle Not Found',
            description: `Vehicle #${vehicleNumber} not found in system`,
            variant: 'destructive',
          });
          return;
        }

        finalVehicleId = vehicleData.id;
      }

      // Insert wash entry
      const { error: insertError } = await supabase
        .from('wash_entries')
        .insert({
          employee_id: userProfile.id,
          vehicle_id: finalVehicleId,
          wash_date: format(date, 'yyyy-MM-dd'),
          actual_location_id: userProfile.location_id,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation - duplicate wash
          toast({
            title: 'Duplicate Wash Entry',
            description: `Vehicle #${vehicleNumber} already washed on ${format(date, 'MMM d, yyyy')}`,
            variant: 'destructive',
          });
        } else {
          throw insertError;
        }
        return;
      }

      // Update vehicle last seen
      await supabase
        .from('vehicles')
        .update({
          last_seen_location_id: userProfile.location_id,
          last_seen_date: format(date, 'yyyy-MM-dd'),
        })
        .eq('id', finalVehicleId);

      toast({
        title: 'Success',
        description: `Vehicle #${vehicleNumber} marked as washed`,
      });

      // Refresh entries
      fetchWeekEntries();
    } catch (error: any) {
      console.error('Error adding wash entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add wash entry',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWash = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wash_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Wash entry deleted',
      });

      fetchWeekEntries();
    } catch (error: any) {
      console.error('Error deleting wash entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete wash entry',
        variant: 'destructive',
      });
    }
  };

  if (!userProfile?.location_id) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Contact admin to assign your location before tracking washes
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {userProfile?.name}!</h1>
          <p className="text-muted-foreground mt-2">Track your vehicle washes</p>
        </div>

        <CutoffBanner />

        {loading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <>
            <WeekView
              currentWeek={currentWeek}
              entries={entries}
              onAddWash={handleAddWash}
              onDeleteWash={handleDeleteWash}
              onPreviousWeek={() => setCurrentWeek(addWeeks(currentWeek, -1))}
              onNextWeek={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              onCurrentWeek={() => setCurrentWeek(new Date())}
              cutoffDate={cutoffDate}
            />

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  This Week Summary
                </CardTitle>
                <CardDescription>Your performance this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{entries.length}</div>
                <p className="text-muted-foreground">
                  vehicles washed
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
