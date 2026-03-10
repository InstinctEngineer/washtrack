import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronRight, Building2, MapPin, Upload, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CSVImportModal } from './CSVImportModal';

interface ClientSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface ClientFormData {
  name: string;
  parent_company: string;
  billing_address: string;
  contact_name: string;
  contact_email: string;
  is_active: boolean;
  default_terms: string;
  default_class: string;
  is_taxable: boolean;
  tax_jurisdiction: string;
  tax_rate: number | null;
}

interface LocationFormData {
  name: string;
  address: string;
  is_active: boolean;
  useExisting: boolean;
  existingLocationId: string;
}

interface ExistingLocation {
  id: string;
  name: string;
  address: string | null;
  client_id: string;
}

const STEPS = [
  { label: 'Client', icon: Building2 },
  { label: 'Location', icon: MapPin },
  { label: 'Work Items', icon: Upload },
];

export function ClientSetupWizard({ open, onOpenChange, onComplete }: ClientSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [createdClientName, setCreatedClientName] = useState<string>('');
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [existingLocations, setExistingLocations] = useState<ExistingLocation[]>([]);
  const [duplicateClient, setDuplicateClient] = useState<{ id: string; name: string } | null>(null);

  const [clientForm, setClientForm] = useState<ClientFormData>({
    name: '',
    parent_company: '',
    billing_address: '',
    contact_name: '',
    contact_email: '',
    is_active: true,
    default_terms: 'Net 30',
    default_class: 'Fleet Services',
    is_taxable: false,
    tax_jurisdiction: 'MN',
    tax_rate: null,
  });

  const [locationForm, setLocationForm] = useState<LocationFormData>({
    name: '',
    address: '',
    is_active: true,
    useExisting: false,
    existingLocationId: '',
  });

  const resetWizard = () => {
    setStep(0);
    setCreatedClientId(null);
    setCreatedClientName('');
    setShowCSVImport(false);
    setClientForm({
      name: '', parent_company: '', billing_address: '', contact_name: '', contact_email: '',
      is_active: true, default_terms: 'Net 30', default_class: 'Fleet Services',
      is_taxable: false, tax_jurisdiction: 'MN', tax_rate: null,
    });
    setLocationForm({ name: '', address: '', is_active: true, useExisting: false, existingLocationId: '' });
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
    if (createdClientId) onComplete();
  };

  const handleCreateClient = async () => {
    if (!clientForm.name.trim()) {
      toast.error('Client name is required');
      return;
    }

    try {
      const { data, error } = await supabase.from('clients').insert([{
        name: clientForm.name,
        parent_company: clientForm.parent_company || null,
        billing_address: clientForm.billing_address || null,
        contact_name: clientForm.contact_name || null,
        contact_email: clientForm.contact_email || null,
        is_active: clientForm.is_active,
        default_terms: clientForm.default_terms || null,
        default_class: clientForm.default_class || null,
        is_taxable: clientForm.is_taxable,
        tax_jurisdiction: clientForm.tax_jurisdiction || null,
        tax_rate: clientForm.tax_rate,
      }]).select('id').single();

      if (error) throw error;

      setCreatedClientId(data.id);
      setCreatedClientName(clientForm.name);

      // Pre-fill location address from billing address
      setLocationForm(prev => ({
        ...prev,
        address: clientForm.billing_address || '',
      }));

      // Fetch existing locations for the "use existing" option
      const { data: locs } = await supabase.from('locations').select('id, name, address, client_id').eq('is_active', true).order('name');
      setExistingLocations(locs || []);

      toast.success('Client created!');
      setStep(1);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create client');
    }
  };

  const handleCreateLocation = async () => {
    if (locationForm.useExisting) {
      if (!locationForm.existingLocationId) {
        toast.error('Please select a location');
        return;
      }
      toast.success('Existing location linked!');
      setStep(2);
      return;
    }

    if (!locationForm.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    try {
      // Case-insensitive duplicate check
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .eq('client_id', createdClientId!)
        .ilike('name', locationForm.name.trim());

      if (existing && existing.length > 0) {
        toast.error('A location with this name already exists for this client');
        return;
      }

      const { error } = await supabase.from('locations').insert([{
        client_id: createdClientId!,
        name: locationForm.name.trim(),
        address: locationForm.address || null,
        is_active: locationForm.is_active,
      }]);

      if (error) throw error;

      toast.success('Location created!');
      setStep(2);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create location');
    }
  };

  if (showCSVImport) {
    return (
      <CSVImportModal
        open={true}
        onOpenChange={(isOpen) => {
          setShowCSVImport(false);
          if (!isOpen) handleClose();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isComplete = i < step;
            const isCurrent = i === step;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors",
                  isComplete && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isComplete && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50"
                )}>
                  {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn(
                  "text-sm font-medium hidden sm:inline",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground"
                )}>{s.label}</span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Create Client */}
        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle>Step 1: Create Client</DialogTitle>
              <DialogDescription>Add a new billing entity</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="w-name">Client Name *</Label>
                <Input id="w-name" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} placeholder="FedEx Ground - Rochester" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-parent">Parent Company</Label>
                <Input id="w-parent" value={clientForm.parent_company} onChange={(e) => setClientForm({ ...clientForm, parent_company: e.target.value })} placeholder="FedEx" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="w-contact">Contact Name</Label>
                  <Input id="w-contact" value={clientForm.contact_name} onChange={(e) => setClientForm({ ...clientForm, contact_name: e.target.value })} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w-email">Contact Email</Label>
                  <Input id="w-email" type="email" value={clientForm.contact_email} onChange={(e) => setClientForm({ ...clientForm, contact_email: e.target.value })} placeholder="john@company.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-address">Billing Address</Label>
                <Textarea id="w-address" value={clientForm.billing_address} onChange={(e) => setClientForm({ ...clientForm, billing_address: e.target.value })} placeholder="123 Main St, City, State 12345" rows={2} />
                <p className="text-xs text-muted-foreground">This will auto-fill the location address in the next step</p>
              </div>

              {/* QB Settings */}
              <div className="border-t pt-3">
                <h3 className="text-sm font-medium mb-3">QuickBooks Settings</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="w-terms">Default Terms</Label>
                    <Input id="w-terms" value={clientForm.default_terms} onChange={(e) => setClientForm({ ...clientForm, default_terms: e.target.value })} placeholder="Net 30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="w-class">Default Class</Label>
                    <Input id="w-class" value={clientForm.default_class} onChange={(e) => setClientForm({ ...clientForm, default_class: e.target.value })} placeholder="Fleet Services" />
                  </div>
                </div>
              </div>

              {/* Tax Settings */}
              <div className="border-t pt-3">
                <h3 className="text-sm font-medium mb-3">Tax Settings</h3>
                <div className="flex items-center space-x-2 mb-3">
                  <Checkbox id="w-taxable" checked={clientForm.is_taxable} onCheckedChange={(c) => setClientForm({ ...clientForm, is_taxable: c === true })} />
                  <Label htmlFor="w-taxable">This client is taxable</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="w-jurisdiction">Tax Jurisdiction</Label>
                    <Input id="w-jurisdiction" value={clientForm.tax_jurisdiction} onChange={(e) => setClientForm({ ...clientForm, tax_jurisdiction: e.target.value })} placeholder="MN" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="w-taxrate">Tax Rate (%)</Label>
                    <Input id="w-taxrate" type="number" step="0.01" min="0" max="100" value={clientForm.tax_rate ?? ''} onChange={(e) => setClientForm({ ...clientForm, tax_rate: e.target.value ? parseFloat(e.target.value) : null })} placeholder="8.25" />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="w-active" checked={clientForm.is_active} onCheckedChange={(c) => setClientForm({ ...clientForm, is_active: c === true })} />
                <Label htmlFor="w-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCreateClient}>
                Create Client & Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Add Location */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Step 2: Add Location</DialogTitle>
              <DialogDescription>
                Map a physical work site to <Badge variant="outline" className="ml-1">{createdClientName}</Badge>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="w-useexisting"
                  checked={locationForm.useExisting}
                  onCheckedChange={(c) => setLocationForm({ ...locationForm, useExisting: c === true })}
                />
                <Label htmlFor="w-useexisting">Use an existing location</Label>
              </div>

              {locationForm.useExisting ? (
                <div className="space-y-2">
                  <Label>Select Location</Label>
                  <Select value={locationForm.existingLocationId} onValueChange={(v) => setLocationForm({ ...locationForm, existingLocationId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLocations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} {loc.address ? `— ${loc.address}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="w-locname">Location Name *</Label>
                    <Input id="w-locname" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} placeholder="Main Warehouse" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="w-locaddr">Address</Label>
                    <Textarea id="w-locaddr" value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} placeholder="123 Main St, City, State 12345" rows={2} />
                    {locationForm.address && locationForm.address === clientForm.billing_address && (
                      <p className="text-xs text-muted-foreground">Auto-filled from billing address</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="w-locactive" checked={locationForm.is_active} onCheckedChange={(c) => setLocationForm({ ...locationForm, is_active: c === true })} />
                    <Label htmlFor="w-locactive">Active</Label>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Skip</Button>
                <Button onClick={handleCreateLocation}>
                  {locationForm.useExisting ? 'Link' : 'Create'} Location & Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Work Items */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Step 3: Add Work Items</DialogTitle>
              <DialogDescription>
                Bulk upload services for <Badge variant="outline" className="ml-1">{createdClientName}</Badge>
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload a CSV file to bulk-create work items, rate configs, and services for this client.
              </p>
              <Button onClick={() => setShowCSVImport(true)} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Open Bulk Upload Tool
              </Button>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
