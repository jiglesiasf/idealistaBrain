import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { getMissingSupabaseEnvKeys } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Idealista Brain",
  description: "Producto web para analisis buy-to-rent en vivo sobre Idealista.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const missingEnv = getMissingSupabaseEnvKeys();
  let userEmail: string | null = null;

  if (missingEnv.length === 0) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      userEmail = user?.email ?? null;
    } catch {
      userEmail = null;
    }
  }

  return (
    <html lang="es">
      <body>
        <div className="page-shell">
          <header className="site-header">
            <Link href="/" className="brand-link">
              <div className="brand-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div className="brand-copy">
                <p className="eyebrow">Idealista Brain</p>
                <h1 className="brand-title">Rental Intelligence</h1>
              </div>
            </Link>

            <nav className="nav-row">
              <NavLink href="/" exact>
                Analizar
              </NavLink>
              <NavLink href="/dashboard">
                Historial
              </NavLink>
              <NavLink href="/runner">
                Runner
              </NavLink>
              <NavLink href="/calculator">
                Calculadora
              </NavLink>
              <NavLink href="/pisos-interesantes">
                Pisos Interesantes
              </NavLink>
              <NavLink href="/seguimiento">
                Seguimiento
              </NavLink>

              {userEmail ? (
                <>
                  <span className="nav-chip">{userEmail}</span>
                  <form action={signOutAction}>
                    <button className="danger-button" type="submit">
                      Salir
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="ghost-button">
                    Entrar
                  </Link>
                  <Link href="/sign-up" className="primary-button">
                    Crear cuenta
                  </Link>
                </>
              )}
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
