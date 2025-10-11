import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Vehicle, VehicleType, Location } from '@/types/database';

const vehicleSchema = z.object({
  vehicle_number: z
    .string()
    .min(1, 'Vehicle number is required')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Only alphanumeric characters, dashes, and underscores allowed'),
  vehicle_type_id: z.string().min(1, 'Vehicle type is required'),
  home_location_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  vehicle?: Vehicle;
  vehicleTypes: VehicleType[];
  locations: Location[];
  onSubmit: (data: VehicleFormData) => Promise<void>;
  onCancel: () => void;
}

export function VehicleForm({
  vehicle,
  vehicleTypes,
  locations,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicle_number: vehicle?.vehicle_number || '',
      vehicle_type_id: vehicle?.vehicle_type_id || '',
      home_location_id: vehicle?.home_location_id || '',
      is_active: vehicle?.is_active ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="vehicle_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., V-1234" {...field} disabled={!!vehicle} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vehicle_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vehicleTypes
                    .filter((type) => type.is_active)
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.type_name} - ${type.rate_per_wash}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="home_location_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home Location (Optional)</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} 
                defaultValue={field.value || 'none'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {locations
                    .filter((loc) => loc.is_active)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Active</FormLabel>
              </div>
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
