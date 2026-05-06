import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error?: Error;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Distill render failure.', error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="appErrorBoundary">
        <section className="appErrorCard">
          <p>Recovery</p>
          <h1>Distill could not render safely</h1>
          <span>
            アプリの表示中にエラーが発生しました。データ本体ではなく、WebViewキャッシュや一時状態が原因の場合があります。
          </span>
          <div className="appErrorActions">
            <button type="button" onClick={() => window.location.reload()}>
              Reload Distill
            </button>
          </div>
          <ol>
            <li>Close Distill completely.</li>
            <li>Back up the folder `C:\Users\awake\AppData\Local\app.distill.local` before deleting anything.</li>
            <li>If reload still fails, rename only `EBWebView` to `EBWebView.backup` and restart Distill.</li>
            <li>Keep encrypted vault backups before reinstalling or clearing app data.</li>
          </ol>
          <small>{this.state.error.message}</small>
        </section>
      </main>
    );
  }
}
