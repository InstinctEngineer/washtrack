import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  name: string;
}

interface CreateLocationInlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName: string;
  prefillClientId: string | null;
  clients: Client[];
  onLocationCreated: (location: { id: string; name: string; client_id: string }) => void;
}

export function CreateLocationInlineModal({
  open,
  onOpenChange,
  prefillName,
  prefillClientId,
  clients,
  onLocationCreated,
}: CreateLocationInlineModalProps) {
  const [name, setName] = useState(prefillName);
  const [address, setAddress] = useState("");
  const [clientId, setClientId] = useState(prefillClientId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Location name is required",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("locations")
        .insert({
          name: name.trim(),
          address: address.trim() || null,
          client_id: clientId,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Location created",
        description: `"${data.name}" has been created successfully.`,
      });

      onLocationCreated({ id: data.id, name: data.name, client_id: data.client_id });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating location:", error);
      toast({
        title: "Error creating location",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location-client">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-name">Location Name *</Label>
              <Input
                id="location-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter location name"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-address">Address</Label>
              <Input
                id="location-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Location address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
