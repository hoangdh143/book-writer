import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render(): ReactNode {
    const error = this.state.error
    if (error === null) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-300">Something went wrong</h1>
          <p className="mt-2 break-words text-sm text-red-200/80">{error.message}</p>
          <button
            className="mt-4 rounded-lg border border-red-800 bg-red-950/60 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-900/60"
            onClick={() => window.location.reload()}
          >
            Reload the app
          </button>
        </div>
      </div>
    )
  }
}
