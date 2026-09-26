import { useSession } from "../session/SessionContext";

// Session expired / not permitted: retrying cannot help, so the only honest next step is a new session.
export function SessionProblem({ message }: { message: string }) {
  const { restart } = useSession();
  return (
    <section className="error" role="alert">
      <h2>需要重新開始</h2>
      <p>{message}</p>
      <p>先前的結果不會顯示為已完成。重新開始後需要再次同意服務說明並填寫評估。</p>
      <button type="button" className="button secondary" onClick={() => restart()}>
        重新開始
      </button>
    </section>
  );
}
