import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="font-display text-[32px] leading-9 font-extrabold tracking-tight uppercase">
        Entrar
      </h1>
      <p className="text-ink-muted">Enviamos um link de acesso para o seu e-mail. Sem senha.</p>
      <LoginForm />
    </main>
  );
}
