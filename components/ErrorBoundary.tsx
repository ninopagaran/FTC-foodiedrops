import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // In a real app, log to Sentry/LogRocket here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-red-600 text-white flex items-center justify-center font-bold text-5xl mb-8 border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">!</div>
            <h1 className="font-heading text-4xl font-black italic uppercase tracking-tighter mb-4">Something went wrong.</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest mb-8 max-w-md">
                We encountered an unexpected issue. Our team has been notified.
            </p>
            <button 
                onClick={() => window.location.reload()} 
                className="bg-white text-black px-8 py-4 font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
                Reload Application
            </button>
            {/* Safe check for development environment variables */}
            {((import.meta as any).env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) && (
                <pre className="mt-8 p-4 bg-zinc-900 border border-red-900 text-red-400 text-left text-xs overflow-auto max-w-2xl">
                    {this.state.error?.toString()}
                </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}