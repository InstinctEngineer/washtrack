import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Detects whether the current route is in payroll mode and toggles
 * `data-mode="payroll"` on the <html> element so the entire app
 * re-themes via the CSS overrides in index.css.
 */
export const usePayrollMode = (): boolean => {
  const location = useLocation();
  const isPayroll = location.pathname.startsWith('/payroll');

  useEffect(() => {
    const root = document.documentElement;
    if (isPayroll) {
      root.setAttribute('data-mode', 'payroll');
    } else {
      root.removeAttribute('data-mode');
    }
    return () => {
      root.removeAttribute('data-mode');
    };
  }, [isPayroll]);

  return isPayroll;
};