import Link from "next/link";
import { signInAction } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-shell">
      <section className="auth-aside">
        <p className="eyebrow">Acceso web</p>
        <h2>Entra para lanzar jobs y guardar resultados.</h2>
        <p className="muted">
          La extension no tiene usuario ni historial. Toda la propiedad del trabajo vive aqui, en la capa web.
        </p>

        <ul className="auth-points">
          <li>Lanza analisis desde cualquier URL valida de Idealista.</li>
          <li>Revisa progreso, eventos y resultados desde una sola interfaz.</li>
          <li>Guarda el historial sin convertir la extension en un producto aparte.</li>
        </ul>
      </section>

      <section className="card auth-card">
        <div className="card-header">
          <div>
            <span className="section-label">Auth</span>
            <h2 className="card-title">Entrar</h2>
            <p className="muted">Usamos Supabase Auth para jobs, historial y resultados persistidos.</p>
          </div>
        </div>

        {error ? <p className="status-line error">{decodeURIComponent(error)}</p> : null}

        <form action={signInAction} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>

          <div className="action-row">
            <button className="primary-button" type="submit">
              Entrar
            </button>
            <Link href="/sign-up" className="ghost-button">
              Crear cuenta
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
