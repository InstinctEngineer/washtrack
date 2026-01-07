import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, ChevronRight, ChevronLeft, CalendarDays, MapPin, Truck, Send, Clock, Table2, MessageSquare, Play, CheckCircle2, SkipForward, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
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
  type?: 'informational' | 'interactive'; // Step behavior type
  action?: 'click' | 'select'; // What action completes this step
  successMessage?: string; // Toast message on success
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
        description: 'Try clicking the left arrow to go back one day.',
        position: 'right',
        type: 'interactive',
        action: 'click',
        successMessage: 'Great! You navigated to the previous day.',
      },
      {
        id: 'date-nav-3',
        targetSelector: '[data-demo="next-day"]',
        title: 'Next Day',
        description: 'Now click the right arrow to move forward.',
        position: 'left',
        type: 'interactive',
        action: 'click',
        successMessage: 'Perfect! You moved to the next day.',
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
        targetSelector: '[data-demo="vehicle-card"]',
        title: 'Select a Vehicle',
        description: 'Tap on a vehicle card to select it. Try clicking one now!',
        position: 'bottom',
        type: 'interactive',
        action: 'click',
        successMessage: 'Nice! You selected a vehicle.',
      },
      {
        id: 'vehicles-3',
        targetSelector: '[data-demo="vehicles-grid"]',
        title: 'Selection Indicator',
        description: 'Selected items show a green border and checkmark. Items already logged today appear grayed out.',
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
        description: 'This card shows how many items you\'ve selected. Use the "Clear" button to deselect all.',
        position: 'bottom',
        optional: true,
      },
      {
        id: 'submit-2',
        targetSelector: '[data-demo="submit-button"]',
        title: 'Submit Button',
        description: 'Tap this green button to submit all your selected entries at once. The entries will be recorded for the currently selected date.',
        position: 'top',
        optional: true,
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
        optional: true,
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
  const [stepHistory, setStepHistory] = useState<{ featureId: string; stepIndex: number }[]>([]);
  const [activeFeature, setActiveFeature] = useState<DemoFeature | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [animatedRect, setAnimatedRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [targetBorderRadius, setTargetBorderRadius] = useState('8px');
  const [tooltipVisible, setTooltipVisible] = useState(true);
  const [completedFeatures, setCompletedFeatures] = useState<Set<string>>(new Set());
  const [showingInteractionResult, setShowingInteractionResult] = useState(false);

  const isDemoActive = activeFeature !== null;
  const currentStep = activeFeature?.steps[currentStepIndex];
  const isLastStep = activeFeature ? currentStepIndex === activeFeature.steps.length - 1 : false;

  // Get target element's actual border radius
  const getTargetBorderRadius = (target: Element): string => {
    const computed = window.getComputedStyle(target);
    return computed.borderRadius || '8px';
  };

  // Animate rect changes smoothly
  useEffect(() => {
    if (targetRect) {
      setAnimatedRect({
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
      });
    } else {
      setAnimatedRect(null);
    }
  }, [targetRect]);

  // Fade tooltip on step change
  useEffect(() => {
    if (isDemoActive) {
      setTooltipVisible(false);
      const timer = setTimeout(() => setTooltipVisible(true), 150);
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, activeFeature?.id]);

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

    // Special handling for vehicle-card: expand the first collapsible section if needed
    if (currentStep.targetSelector === '[data-demo="vehicle-card"]') {
      const vehicleCard = document.querySelector('[data-demo="vehicle-card"]');
      if (!vehicleCard) {
        // Click the first collapsed section trigger to expand it
        const firstSectionTrigger = document.querySelector('[data-demo="vehicles-grid"] button[data-state="closed"]');
        if (firstSectionTrigger instanceof HTMLElement) {
          firstSectionTrigger.click();
          // Re-run after a short delay to let the section expand
          setTimeout(() => updateTargetPosition(), 150);
          return;
        }
      }
    }

    const target = document.querySelector(currentStep.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      setTargetBorderRadius(getTargetBorderRadius(target));
      
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
    setStepHistory([]);
    
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
    setStepHistory([]);
    
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

    // Save current position to history before moving
    setStepHistory(prev => [...prev, { featureId: activeFeature.id, stepIndex: currentStepIndex }]);

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

  const prevStep = () => {
    if (stepHistory.length === 0) return;
    
    const previousPosition = stepHistory[stepHistory.length - 1];
    setStepHistory(prev => prev.slice(0, -1));
    
    const feature = DEMO_FEATURES.find(f => f.id === previousPosition.featureId);
    if (feature) {
      setActiveFeature(feature);
      setCurrentStepIndex(previousPosition.stepIndex);
    }
  };

  const exitDemo = () => {
    setActiveFeature(null);
    setCurrentStepIndex(0);
    setTargetRect(null);
    setStepHistory([]);
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

  // Calculate progress through tour (overall step count across all features)
  const getTourProgress = () => {
    const currentFeatureIndex = DEMO_FEATURES.findIndex(f => f.id === activeFeature?.id);
    
    // Calculate total steps and current step number
    let totalSteps = 0;
    let currentStepNumber = 0;
    
    for (let i = 0; i < DEMO_FEATURES.length; i++) {
      const feature = DEMO_FEATURES[i];
      if (i < currentFeatureIndex) {
        currentStepNumber += feature.steps.length;
      } else if (i === currentFeatureIndex) {
        currentStepNumber += currentStepIndex + 1;
      }
      totalSteps += feature.steps.length;
    }
    
    return { 
      currentStep: currentStepNumber, 
      totalSteps,
      currentFeature: currentFeatureIndex + 1, 
      totalFeatures: DEMO_FEATURES.length,
      percentage: Math.round((currentStepNumber / totalSteps) * 100)
    };
  };

  // Render demo overlay with spotlight
  const renderOverlay = () => {
    if (!isDemoActive) return null;

    const spotlightPadding = 6;
    const progress = getTourProgress();

    return createPortal(
      <>
        {/* Demo Mode Banner with Progress */}
        <div className="fixed top-0 left-0 right-0 z-[10003] bg-primary text-primary-foreground">
          <div className="py-2 px-4">
            <div className="flex items-center justify-between max-w-screen-lg mx-auto">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-medium">Demo Mode</span>
                <span className="text-sm opacity-75">
                  - {activeFeature?.name} (Step {progress.currentStep}/{progress.totalSteps})
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
          {/* Progress Bar */}
          <Progress 
            value={progress.percentage} 
            className="h-1 rounded-none bg-primary-foreground/20"
          />
        </div>

        {/* Highlight Ring - no dark overlay, just the ring with smooth transitions */}
        {animatedRect && !showingInteractionResult && (
          <div
            className={cn(
              "fixed z-[10001] pointer-events-none demo-highlight-ring",
              currentStep?.type === 'interactive' && "interactive"
            )}
            style={{
              top: animatedRect.top - spotlightPadding,
              left: animatedRect.left - spotlightPadding,
              width: animatedRect.width + spotlightPadding * 2,
              height: animatedRect.height + spotlightPadding * 2,
              borderRadius: targetBorderRadius,
            }}
          />
        )}

        {/* Clickable area for interactive steps */}
        {animatedRect && !showingInteractionResult && currentStep?.type === 'interactive' && (
          <div
            className="fixed z-[10002] pointer-events-auto cursor-pointer"
            style={{
              top: animatedRect.top,
              left: animatedRect.left,
              width: animatedRect.width,
              height: animatedRect.height,
              borderRadius: targetBorderRadius,
            }}
            onClick={(e) => {
              e.stopPropagation();
              const target = document.querySelector(currentStep?.targetSelector || '');
              if (target instanceof HTMLElement) {
                target.click();
              }
              setShowingInteractionResult(true);
              setTimeout(() => {
                setShowingInteractionResult(false);
                if (currentStep.successMessage) {
                  toast.success(currentStep.successMessage);
                }
                nextStep();
              }, 1200);
            }}
          />
        )}

        {/* "See what happened" indicator during interaction result viewing */}
        {showingInteractionResult && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10003] bg-success text-success-foreground px-5 py-3 rounded-full shadow-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <span className="font-medium">See what happened...</span>
          </div>
        )}

        {/* Tooltip Card - distinctive styling with primary background */}
        {currentStep && !showingInteractionResult && (
          <Card
            className={cn(
              "demo-tooltip shadow-2xl border-0 pointer-events-auto bg-primary text-primary-foreground",
              tooltipVisible ? "demo-tooltip-enter" : "demo-tooltip-exit"
            )}
            style={getTooltipStyle()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow - only show if we have a target */}
            {targetRect && (
              <div 
                style={{
                  ...getArrowStyle().style as React.CSSProperties,
                  borderTopColor: currentStep.position === 'top' ? 'hsl(var(--primary))' : undefined,
                  borderBottomColor: currentStep.position === 'bottom' ? 'hsl(var(--primary))' : undefined,
                  borderLeftColor: currentStep.position === 'left' ? 'hsl(var(--primary))' : undefined,
                  borderRightColor: currentStep.position === 'right' ? 'hsl(var(--primary))' : undefined,
                }} 
              />
            )}

            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-primary-foreground">
                  <span className="opacity-80">{activeFeature?.icon}</span>
                  {currentStep.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={exitDemo}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-primary-foreground/70">
                Step {currentStepIndex + 1} of {activeFeature?.steps.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-primary-foreground/90">
                {!targetRect && currentStep.optional 
                  ? "This feature is not available in your current setup - skipping..."
                  : currentStep.description
                }
              </p>
              {currentStep.type === 'interactive' && targetRect ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-primary-foreground">
                    <span className="text-2xl animate-bounce">👆</span>
                    <span className="text-sm font-medium">Click the highlighted area</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={exitDemo}
                      className="text-primary-foreground hover:bg-primary-foreground/20"
                    >
                      Skip Tour
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={prevStep}
                        disabled={stepHistory.length === 0}
                        className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={nextStep}
                        className="text-primary-foreground hover:bg-primary-foreground/20"
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={exitDemo}
                    className="text-primary-foreground hover:bg-primary-foreground/20"
                  >
                    Skip Tour
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={prevStep}
                      disabled={stepHistory.length === 0}
                      className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={nextStep}
                      className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    >
                      {isLastStep && DEMO_FEATURES.findIndex(f => f.id === activeFeature?.id) === DEMO_FEATURES.length - 1 
                        ? 'Finish Tour' 
                        : isLastStep 
                          ? 'Next Feature' 
                          : 'Next'
                      }
                      {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                    </Button>
                  </div>
                </div>
              )}
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
