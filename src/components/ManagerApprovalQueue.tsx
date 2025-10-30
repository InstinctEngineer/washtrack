import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  employee_id: string;
  wash_entry_id: string;
  reason: string | null;
  created_at: string;
  employee: {
    name: string;
    email: string;
  } | null;
  wash_entry: {
    wash_date: string;
    vehicle: {
      vehicle_number: string;
      vehicle_type: {
        type_name: string;
      } | null;
    } | null;
  } | null;
}

export function ManagerApprovalQueue({ managerId }: { managerId: string }) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [managerId]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch approval requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('manager_approval_requests')
        .select(`
          *,
          wash_entry:wash_entries(
            wash_date,
            vehicle:vehicles(
              vehicle_number, 
              vehicle_type:vehicle_types(type_name)
            )
          )
        `)
        .eq('manager_id', managerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch employee data separately
      const employeeIds = [...new Set(requestsData?.map(r => r.employee_id) || [])];
      const { data: employeesData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', employeeIds);

      const employeesMap = new Map(employeesData?.map(e => [e.id, e]) || []);

      // Combine data
      const combined = requestsData?.map(req => ({
        ...req,
        employee: employeesMap.get(req.employee_id) || null,
      })) || [];

      setRequests(combined as ApprovalRequest[]);
    } catch (error) {
      console.error('Error fetching approval requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load approval requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, washEntryId: string) => {
    setProcessingId(requestId);
    try {
      // Update wash entry to soft delete
      const { error: washError } = await supabase
        .from('wash_entries')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: managerId,
          deletion_reason: 'Manager approved removal',
        })
        .eq('id', washEntryId);

      if (washError) throw washError;

      // Update approval request
      const { error: requestError } = await supabase
        .from('manager_approval_requests')
        .update({
          status: 'approved',
          reviewed_by: managerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      toast({
        title: 'Approved',
        description: 'Wash entry has been removed',
      });

      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('manager_approval_requests')
        .update({
          status: 'denied',
          reviewed_by: managerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Denied',
        description: 'Request has been denied',
      });

      fetchRequests();
    } catch (error) {
      console.error('Error denying request:', error);
      toast({
        title: 'Error',
        description: 'Failed to deny request',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading approval requests...</p>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending approval requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Approvals ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-foreground">
                  {request.employee?.name || 'Unknown Employee'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Wants to remove: <span className="font-medium text-foreground">
                    Vehicle {request.wash_entry?.vehicle?.vehicle_number || 'N/A'}
                  </span>
                  {request.wash_entry?.vehicle?.vehicle_type?.type_name && (
                    <span> ({request.wash_entry.vehicle.vehicle_type.type_name})</span>
                  )}
                </div>
                {request.wash_entry?.wash_date && (
                  <div className="text-sm text-muted-foreground">
                    Wash Date: {format(new Date(request.wash_entry.wash_date), 'MMM d, yyyy')}
                  </div>
                )}
                {request.reason && (
                  <div className="text-sm mt-2 p-2 bg-muted rounded">
                    <strong>Reason:</strong> {request.reason}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Requested: {format(new Date(request.created_at), 'MMM d, h:mm a')}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(request.id, request.wash_entry_id)}
                  variant="default"
                  size="sm"
                  disabled={processingId === request.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleDeny(request.id)}
                  variant="outline"
                  size="sm"
                  disabled={processingId === request.id}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
