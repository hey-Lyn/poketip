import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="content errorBoundary">
          <div className="errorBoundaryCard">
            <h1>Something went wrong</h1>
            <p>
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
