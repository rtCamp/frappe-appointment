import { useEffect } from 'react';

const useBack = (callback:VoidFunction) => {

  useEffect(() => {
    // Listen for popstate events (back/forward navigation)
    const handleBackNavigation = () => {
      callback();
    };

    window.addEventListener('popstate', handleBackNavigation);

    // Clean up the event listener
    return () => {
      window.removeEventListener('popstate', handleBackNavigation);
    };
  }, [callback]); // Re-run the effect if `callback` changes
};

export default useBack;