import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PortalShell } from '@/components/PortalShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface MyLoc { location_id: string; location_name: string; client_name: string; business_type: string | null; }

export default function PortalDashboard() {
  const [locations, setLocations] = useState<MyLoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_portal_my_locations');
      setLocations((data as MyLoc[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <PortalShell title="Your Locations">
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : locations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No locations yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You don't have access to any locations. Request access and a team member will review.
            </p>
            <Button asChild><Link to="/portal/request-access">Request Access</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <Link key={l.location_id} to={`/portal/locations/${l.location_id}`}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-1" />
                    <div>
                      <CardTitle className="text-lg">{l.location_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{l.client_name}</p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
