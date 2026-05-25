import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(_error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-3xl p-10 max-w-md w-full border border-zinc-800 text-center">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-zinc-400 mb-6">
              An error occurred while loading this page. Please try again.
            </p>
            <button
              onClick={this.handleReset}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-medium transition"
            >
              Go to Dashboard
            </button>
            {import.meta.env.DEV && this.state.errorInfo && (
              <div className="mt-6 p-4 bg-black rounded-xl text-left">
                <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;