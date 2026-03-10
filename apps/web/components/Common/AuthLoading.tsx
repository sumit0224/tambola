export function AuthLoading({ message = "Checking your session..." }: { message?: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading-spinner" />
      <p>{message}</p>
    </div>
  );
}
