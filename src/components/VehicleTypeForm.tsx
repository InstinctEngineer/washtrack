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
import { VehicleType } from '@/types/database';

const vehicleTypeSchema = z.object({
  type_name: z.string().min(1, 'Type name is required').max(100),
  rate_per_wash: z.string().min(0.01, 'Rate must be greater than 0'),
  is_active: z.boolean().default(true),
});

type VehicleTypeFormData = z.infer<typeof vehicleTypeSchema>;

interface VehicleTypeFormProps {
  vehicleType?: VehicleType;
  onSubmit: (data: VehicleTypeFormData) => Promise<void>;
  onCancel: () => void;
}

export function VehicleTypeForm({ vehicleType, onSubmit, onCancel }: VehicleTypeFormProps) {
  const form = useForm<VehicleTypeFormData>({
    resolver: zodResolver(vehicleTypeSchema),
    defaultValues: {
      type_name: vehicleType?.type_name || '',
      rate_per_wash: vehicleType?.rate_per_wash?.toString() || '',
      is_active: vehicleType?.is_active ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Sedan, SUV, Truck" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rate_per_wash"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rate Per Wash ($)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
              </FormControl>
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
