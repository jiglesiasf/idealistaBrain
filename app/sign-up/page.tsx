import Link from "next/link";
import { signUpAction } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <div className="auth-shell">
      <section className="auth-aside">
        <p className="eyebrow">Cuenta web</p>
        <h2>Crea tu acceso y deja que la web lo orqueste todo.</h2>
        <p className="muted">
          La cuenta web es donde viven los jobs, los resultados y el historial. La extension solo ejecuta el trabajo
          puntual que requiere navegador real.
        </p>

        <ul className="auth-points">
          <li>Una sola capa de producto para el usuario.</li>
          <li>La extension sigue ligera, sin estado de cuenta ni panel propio.</li>
          <li>Todo queda listo para crecer a historial, comparacion y reporting.</li>
        </ul>
      </section>

      <section className="card auth-card">
        <div className="card-header">
          <div>
            <span className="section-label">Auth</span>
            <h2 className="card-title">Crear cuenta</h2>
            <p className="muted">La extension se mantiene sin estado. La propiedad vive aqui, en la web.</p>
          </div>
        </div>

        {error ? <p className="status-line error">{decodeURIComponent(error)}</p> : null}
        {success ? (
          <p className="status-line success">
            Cuenta creada. Si la confirmacion por email esta activa, revisa tu bandeja antes de continuar.
          </p>
        ) : null}

        <form action={signUpAction} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required />
          </div>

          <div className="action-row">
            <button className="primary-button" type="submit">
              Crear cuenta
            </button>
            <Link href="/login" className="ghost-button">
              Ya tengo cuenta
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
