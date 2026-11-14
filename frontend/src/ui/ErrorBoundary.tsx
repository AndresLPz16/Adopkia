import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

// Si un componente falla al dibujarse, React desmonta todo y la página queda
// en blanco. Esta barrera muestra en su lugar una pantalla con salida.

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error al mostrar Adopkia:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="login">
        <div className="login__card app-error">
          <h1>Algo no salió bien</h1>
          <p role="alert">
            No pudimos mostrar esta página. Tus datos guardados no se
            perdieron; recarga para volver a intentarlo.
          </p>
          <div className="app-error__actions">
            <button
              type="button"
              className="portal-button"
              onClick={() => window.location.reload()}
            >
              Recargar la página
            </button>
            <a className="portal-button portal-button--secondary" href="/">
              Ir al inicio
            </a>
          </div>
        </div>
      </main>
    );
  }
}
