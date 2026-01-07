import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, ChevronRight, CalendarDays, MapPin, Truck, Send, Clock, Table2, MessageSquare, Play, CheckCircle2, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { toast } from 'sonner';

interface DemoStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  optional?: boolean; // Skip if element not found
}

interface DemoFeature {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  steps: DemoStep[];
}

const DEMO_FEATURES: DemoFeature[] = [
  {
    id: 'date-navigation',
    name: 'Date Navigation',
    icon: <CalendarDays className="h-5 w-5" />,
    description: 'Navigate between days to log work',
    steps: [
      {
        id: 'date-nav-1',
        targetSelector: '[data-demo="date-nav"]',
        title: 'Date Navigator',
        description: 'This shows the current date for logging work. Use the arrow buttons on either side to move between days.',
        position: 'bottom',
      },
      {
        id: 'date-nav-2',
        targetSelector: '[data-demo="prev-day"]',
        title: 'Previous Day',
        description: 'Tap the left arrow to go back one day and log work for past dates.',
        position: 'right',
      },
      {
        id: 'date-nav-3',
        targetSelector: '[data-demo="next-day"]',
        title: 'Next Day',
        description: 'Tap the right arrow to move forward (you cannot log future dates).',
        position: 'left',
      },
    ],
  },
  {
    id: 'location-selector',
    name: 'Location Selector',
    icon: <MapPin className="h-5 w-5" />,
    description: 'Switch between your assigned locations',
    steps: [
      {
        id: 'location-1',
        targetSelector: '[data-demo="location-select"]',
        title: 'Location Selector',
        description: 'If you work at multiple locations, use this dropdown to switch between them. Your vehicles and services will update based on the selected location.',
        position: 'bottom',
        optional: true, // Skip if user only has one location
      },
    ],
  },
  {
    id: 'vehicles-grid',
    name: 'Vehicles & Equipment',
    icon: <Truck className="h-5 w-5" />,
    description: 'Select and log vehicle washes',
    steps: [
      {
        id: 'vehicles-1',
        targetSelector: '[data-demo="vehicles-grid"]',
        title: 'Vehicles & Equipment Grid',
        description: 'This grid shows all vehicles and equipment at your location. Each card represents one item you can log work for.',
        position: 'bottom',
      },
      {
        id: 'vehicles-2',
        targetSelector: '[data-demo="vehicles-grid"]',
        title: 'Selecting Vehicles',
        description: 'Tap on a vehicle card to select it. Selected items will show a green border and checkmark. Tap again to deselect.',
        position: 'bottom',
      },
      {
        id: 'vehicles-3',
        targetSelector: '[data-demo="vehicles-grid"]',
        title: 'Completed Items',
        description: 'Items that have already been logged today will appear grayed out and cannot be selected again.',
        position: 'bottom',
      },
    ],
  },
  {
    id: 'submit-entries',
    name: 'Submit Entries',
    icon: <Send className="h-5 w-5" />,
    description: 'Submit your selected work entries',
    steps: [
      {
        id: 'submit-1',
        targetSelector: '[data-demo="selection-summary"]',
        title: 'Selection Summary',
        description: 'After selecting vehicles, this card shows how many items you\'ve selected. Use the "Clear" button to deselect all.',
        position: 'bottom',
        optional: true, // Only visible when items are selected
      },
      {
        id: 'submit-2',
        targetSelector: '[data-demo="submit-button"]',
        title: 'Submit Button',
        description: 'Tap this green button to submit all your selected entries at once. The entries will be recorded for the currently selected date.',
        position: 'top',
        optional: true, // Only visible when items are selected
      },
    ],
  },
  {
    id: 'hourly-services',
    name: 'Hourly Services',
    icon: <Clock className="h-5 w-5" />,
    description: 'Log time-based work like detailing',
    steps: [
      {
        id: 'hourly-1',
        targetSelector: '[data-demo="hourly-services"]',
        title: 'Hourly Services',
        description: 'This section shows services billed by the hour (like detailing). Tap "Log Hours" to record time spent on these services.',
        position: 'top',
        optional: true, // Only visible if location has hourly services
      },
    ],
  },
  {
    id: 'recent-entries',
    name: 'Recent Entries',
    icon: <Table2 className="h-5 w-5" />,
    description: 'View your recent work log history',
    steps: [
      {
        id: 'recent-1',
        targetSelector: '[data-demo="recent-entries"]',
        title: 'Recent Entries Table',
        description: 'This table shows all work logged this week at your location. You can see the date, item/service, and quantity for each entry.',
        position: 'top',
      },
    ],
  },
  {
    id: 'message-finance',
    name: 'Message Finance',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Send messages to the finance team',
    steps: [
      {
        id: 'message-1',
        targetSelector: '[data-demo="comment-button"]',
        title: 'Message Button',
        description: 'Tap this floating button to open a message dialog. You can send questions or notes to the finance team, and see their replies.',
        position: 'top',
      },
    ],
  },
];

interface GuidedDemoProps {
  className?: string;
}

export function GuidedDemo({ className }: GuidedDemoProps) {
  const { setDemoMode, skippedSteps, addSkippedStep, resetSkippedSteps } = useDemoMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<DemoFeature | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [completedFeatures, setCompletedFeatures] = useState<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement>(null);

  const isDemoActive = activeFeature !== null;
  const currentStep = activeFeature?.steps[currentStepIndex];
  const isLastStep = activeFeature ? currentStepIndex === activeFeature.steps.length - 1 : false;

  // Find next valid step (skipping missing optional elements)
  const findNextValidStep = useCallback((feature: DemoFeature, startIndex: number): number => {
    for (let i = startIndex; i < feature.steps.length; i++) {
      const step = feature.steps[i];
      const target = document.querySelector(step.targetSelector);
      if (target) return i;
      if (!step.optional) return i; // Non-optional step must be shown even if missing
    }
    return -1; // No valid steps remaining
  }, []);

  // Find next valid feature
  const findNextValidFeature = useCallback((currentFeatureIndex: number): { feature: DemoFeature; stepIndex: number } | null => {
    for (let i = currentFeatureIndex + 1; i < DEMO_FEATURES.length; i++) {
      const feature = DEMO_FEATURES[i];
      const validStep = findNextValidStep(feature, 0);
      if (validStep !== -1) {
        return { feature, stepIndex: validStep };
      }
    }
    return null;
  }, [findNextValidStep]);

  // Find and position spotlight on target element
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(currentStep.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      
      // Scroll target into view if needed
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Element not found
      if (currentStep.optional) {
        // Skip this step automatically
        addSkippedStep();
        
        // Try to find next valid step in current feature
        const nextValidIndex = findNextValidStep(activeFeature!, currentStepIndex + 1);
        if (nextValidIndex !== -1) {
          setCurrentStepIndex(nextValidIndex);
          return;
        }
        
        // No more steps in this feature, try next feature
        const currentFeatureIndex = DEMO_FEATURES.findIndex(f => f.id === activeFeature?.id);
        const nextFeature = findNextValidFeature(currentFeatureIndex);
        if (nextFeature) {
          setCompletedFeatures(prev => new Set([...prev, activeFeature!.id]));
          setActiveFeature(nextFeature.feature);
          setCurrentStepIndex(nextFeature.stepIndex);
          return;
        }
        
        // No more valid features, end tour
        exitDemo();
      } else {
        // Non-optional element not found - show tooltip anyway with a message
        setTargetRect(null);
      }
    }
  }, [currentStep, activeFeature, currentStepIndex, findNextValidStep, findNextValidFeature, addSkippedStep]);

  useEffect(() => {
    if (isDemoActive) {
      // Small delay to let DOM settle
      const timeout = setTimeout(updateTargetPosition, 100);
      return () => clearTimeout(timeout);
    }
  }, [isDemoActive, currentStepIndex, activeFeature, updateTargetPosition]);

  useEffect(() => {
    if (!isDemoActive) return;
    
    // Update position on resize/scroll
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);
    
    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [isDemoActive, updateTargetPosition]);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDemoActive) {
        exitDemo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDemoActive]);

  const startFeatureDemo = (feature: DemoFeature) => {
    setMenuOpen(false);
    resetSkippedSteps();
    
    // Find first valid step
    const validStep = findNextValidStep(feature, 0);
    if (validStep === -1) {
      // No valid steps in this feature
      toast.info('This feature is not available in your current setup');
      return;
    }
    
    setActiveFeature(feature);
    setCurrentStepIndex(validStep);
    setDemoMode(true);
  };

  const startFullTour = () => {
    setMenuOpen(false);
    resetSkippedSteps();
    
    // Find first valid feature and step
    for (let i = 0; i < DEMO_FEATURES.length; i++) {
      const validStep = findNextValidStep(DEMO_FEATURES[i], 0);
      if (validStep !== -1) {
        setActiveFeature(DEMO_FEATURES[i]);
        setCurrentStepIndex(validStep);
        setDemoMode(true);
        return;
      }
    }
    
    // No valid features found
    toast.error('No demo features available');
  };

  const nextStep = () => {
    if (!activeFeature) return;

    if (isLastStep) {
      // Mark feature as completed
      setCompletedFeatures(prev => new Set([...prev, activeFeature.id]));
      
      // Check if doing full tour
      const currentFeatureIndex = DEMO_FEATURES.findIndex(f => f.id === activeFeature.id);
      const nextFeature = findNextValidFeature(currentFeatureIndex);
      
      if (nextFeature) {
        // Move to next feature in tour
        setActiveFeature(nextFeature.feature);
        setCurrentStepIndex(nextFeature.stepIndex);
      } else {
        // End of tour
        exitDemo();
        toast.success('Tour complete! You\'re ready to start logging work.');
      }
    } else {
      // Find next valid step in current feature
      const nextValidIndex = findNextValidStep(activeFeature, currentStepIndex + 1);
      if (nextValidIndex !== -1) {
        setCurrentStepIndex(nextValidIndex);
      } else {
        // No more valid steps, move to next feature
        const currentFeatureIndex = DEMO_FEATURES.findIndex(f => f.id === activeFeature.id);
        const nextFeature = findNextValidFeature(currentFeatureIndex);
        
        if (nextFeature) {
          setCompletedFeatures(prev => new Set([...prev, activeFeature.id]));
          setActiveFeature(nextFeature.feature);
          setCurrentStepIndex(nextFeature.stepIndex);
        } else {
          exitDemo();
          toast.success('Tour complete! You\'re ready to start logging work.');
        }
      }
    }
  };

  const exitDemo = () => {
    setActiveFeature(null);
    setCurrentStepIndex(0);
    setTargetRect(null);
    setDemoMode(false);
  };

  // Calculate tooltip position based on target rect and preferred position
  const getTooltipStyle = (): React.CSSProperties => {
    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const position = currentStep?.position || 'bottom';

    // If no target, center in viewport
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        zIndex: 10002,
      };
    }

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
    }

    // Keep tooltip in viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 10002,
    };
  };

  const getArrowStyle = (): { direction: string; style: React.CSSProperties } => {
    if (!targetRect || !currentStep) return { direction: '', style: {} };

    const position = currentStep.position;
    const arrowSize = 12;

    switch (position) {
      case 'top':
        return {
          direction: 'down',
          style: {
            position: 'absolute',
            bottom: -arrowSize,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderTop: `${arrowSize}px solid hsl(var(--card))`,
          },
        };
      case 'bottom':
        return {
          direction: 'up',
          style: {
            position: 'absolute',
            top: -arrowSize,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid hsl(var(--card))`,
          },
        };
      case 'left':
        return {
          direction: 'right',
          style: {
            position: 'absolute',
            right: -arrowSize,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderLeft: `${arrowSize}px solid hsl(var(--card))`,
          },
        };
      case 'right':
        return {
          direction: 'left',
          style: {
            position: 'absolute',
            left: -arrowSize,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid hsl(var(--card))`,
          },
        };
    }
  };

  // Calculate progress through tour
  const getTourProgress = () => {
    const currentFeatureIndex = DEMO_FEATURES.findIndex(f => f.id === activeFeature?.id);
    const totalFeatures = DEMO_FEATURES.length;
    return { current: currentFeatureIndex + 1, total: totalFeatures };
  };

  // Render demo overlay with spotlight
  const renderOverlay = () => {
    if (!isDemoActive) return null;

    const spotlightPadding = 8;
    const progress = getTourProgress();

    return createPortal(
      <>
        {/* Demo Mode Banner */}
        <div className="fixed top-0 left-0 right-0 z-[10003] bg-primary text-primary-foreground py-2 px-4">
          <div className="flex items-center justify-between max-w-screen-lg mx-auto">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Demo Mode</span>
              <span className="text-sm opacity-75">
                - {activeFeature?.name} ({progress.current}/{progress.total})
              </span>
              {skippedSteps > 0 && (
                <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded">
                  {skippedSteps} skipped
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitDemo}
              className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-4 w-4 mr-1" />
              Exit Demo
            </Button>
          </div>
        </div>

        {/* Dark overlay - NO onClick to exit */}
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[10000] pointer-events-none"
          style={{
            background: targetRect
              ? `radial-gradient(
                  ellipse ${targetRect.width + spotlightPadding * 2}px ${targetRect.height + spotlightPadding * 2}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
                  transparent 0%,
                  transparent 70%,
                  rgba(0, 0, 0, 0.75) 70%
                )`
              : 'rgba(0, 0, 0, 0.75)',
          }}
        />

        {/* Clickable area around spotlight to allow interaction */}
        {targetRect && (
          <div
            className="fixed z-[10001] pointer-events-auto cursor-pointer"
            style={{
              top: targetRect.top - spotlightPadding,
              left: targetRect.left - spotlightPadding,
              width: targetRect.width + spotlightPadding * 2,
              height: targetRect.height + spotlightPadding * 2,
              borderRadius: '8px',
            }}
            onClick={(e) => {
              // Allow the click to pass through to the actual element
              e.stopPropagation();
              const target = document.querySelector(currentStep?.targetSelector || '');
              if (target instanceof HTMLElement) {
                target.click();
              }
            }}
          />
        )}

        {/* Spotlight border/glow effect */}
        {targetRect && (
          <div
            className="fixed z-[10001] pointer-events-none demo-spotlight-ring"
            style={{
              top: targetRect.top - spotlightPadding,
              left: targetRect.left - spotlightPadding,
              width: targetRect.width + spotlightPadding * 2,
              height: targetRect.height + spotlightPadding * 2,
              borderRadius: '8px',
            }}
          />
        )}

        {/* Tooltip Card */}
        {currentStep && (
          <Card
            className="shadow-2xl border-2 border-primary pointer-events-auto"
            style={getTooltipStyle()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow - only show if we have a target */}
            {targetRect && <div style={getArrowStyle().style as React.CSSProperties} />}

            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {activeFeature?.icon}
                  {currentStep.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={exitDemo}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Step {currentStepIndex + 1} of {activeFeature?.steps.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {!targetRect && currentStep.optional 
                  ? "This feature is not available in your current setup - skipping..."
                  : currentStep.description
                }
              </p>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={exitDemo}>
                  Skip Tour
                </Button>
                <Button size="sm" onClick={nextStep}>
                  {isLastStep && DEMO_FEATURES.findIndex(f => f.id === activeFeature?.id) === DEMO_FEATURES.length - 1 
                    ? 'Finish Tour' 
                    : isLastStep 
                      ? 'Next Feature' 
                      : 'Next'
                  }
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </>,
      document.body
    );
  };

  return (
    <>
      {/* Info Button with Popover Menu */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10 shrink-0 border-2",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary",
              "transition-all duration-200",
              className
            )}
            aria-label="Open demo tutorial"
          >
            <Info className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="start"
          sideOffset={8}
        >
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Dashboard Guide</h3>
            <p className="text-sm text-muted-foreground">
              Learn how to use each feature
            </p>
          </div>

          {/* Full Tour Button */}
          <div className="p-3 border-b">
            <Button
              className="w-full gap-2"
              onClick={startFullTour}
            >
              <Play className="h-4 w-4" />
              Take Full Tour
            </Button>
          </div>

          {/* Feature List */}
          <div className="max-h-[300px] overflow-y-auto">
            {DEMO_FEATURES.map((feature) => {
              const isCompleted = completedFeatures.has(feature.id);
              return (
                <button
                  key={feature.id}
                  onClick={() => startFeatureDemo(feature)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors",
                    isCompleted && "bg-success/10"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-full shrink-0",
                    isCompleted 
                      ? "bg-success/20 text-success" 
                      : "bg-primary/10 text-primary"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{feature.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {feature.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>

          {/* ESC hint */}
          <div className="p-3 border-t bg-muted/50">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">ESC</kbd> to exit demo at any time
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Demo Overlay */}
      {renderOverlay()}
    </>
  );
}
