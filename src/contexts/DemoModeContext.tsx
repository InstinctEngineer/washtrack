import { createContext, useContext, useState, ReactNode } from 'react';

interface DemoModeContextType {
  isDemoMode: boolean;
  setDemoMode: (active: boolean) => void;
  skippedSteps: number;
  addSkippedStep: () => void;
  resetSkippedSteps: () => void;
}

const DemoModeContext = createContext<DemoModeContextType | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState(0);

  const setDemoMode = (active: boolean) => {
    setIsDemoMode(active);
    if (!active) {
      setSkippedSteps(0);
    }
  };

  const addSkippedStep = () => {
    setSkippedSteps(prev => prev + 1);
  };

  const resetSkippedSteps = () => {
    setSkippedSteps(0);
  };

  return (
    <DemoModeContext.Provider value={{ 
      isDemoMode, 
      setDemoMode, 
      skippedSteps, 
      addSkippedStep, 
      resetSkippedSteps 
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
}
