import { Component } from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
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
