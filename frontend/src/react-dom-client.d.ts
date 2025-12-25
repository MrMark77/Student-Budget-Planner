declare module "react-dom/client" {
  import * as React from "react";

  export interface ErrorInfo {
    digest?: string;
    componentStack?: string;
  }

  export interface RootOptions {
    identifierPrefix?: string;
    onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
  }

  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }

  export type Container = Element | DocumentFragment;

  export function createRoot(container: Container, options?: RootOptions): Root;
}



