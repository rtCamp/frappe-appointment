/**
 * External dependencies
 */
import React, { Component, ReactNode } from "react";
/**
 * Internal dependencies
 */
import { default as Typography } from "@/components/ui/typography";

type ErrorFallbackProp = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorFallbackState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorFallback extends Component<ErrorFallbackProp, ErrorFallbackState> {
  state: ErrorFallbackState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorFallbackState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    return hasError
      ? fallback || (
          <div className="w-full h-full flex justify-center items-center">
            <Typography variant="p" className="text-slate-600 font-medium">
              Something went wrong
            </Typography>
          </div>
        )
      : children;
  }
}

export default ErrorFallback;
