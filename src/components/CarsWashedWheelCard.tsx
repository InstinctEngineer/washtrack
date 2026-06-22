import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollWheel } from '@/components/ui/scroll-wheel';
import { Car } from 'lucide-react';

interface CarsWashedWheelCardProps {
  value: number;
  onChange: (n: number) => void;
  savedValue: number | null;
}

export function CarsWashedWheelCard({ value, onChange, savedValue }: CarsWashedWheelCardProps) {
  const dirty = savedValue !== null ? value !== savedValue : value > 0;
  return (
    <Card data-demo="cars-washed-wheel" className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Cars Washed
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {savedValue !== null
            ? `Currently logged today: ${savedValue}. Spin the wheel to update.`
            : 'Spin the wheel to enter how many cars were washed today.'}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollWheel value={value} onChange={onChange} min={0} max={999} />
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {dirty ? (
            <span className="text-primary font-medium">
              Will save {value} car{value === 1 ? '' : 's'} when you submit
            </span>
          ) : (
            <span>Tap the number to type it directly</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}