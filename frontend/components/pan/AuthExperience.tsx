"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, CheckCircle2, CircleCheck, Eye, EyeOff, LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import { useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { forgotPasswordAction, loginAction, registerAction } from "@/services/auth-actions";
import "./AuthExperience.css";

type AuthMode = "login" | "register" | "forgot";

function DeltaBrand() {
  return <span className="ds-auth-wordmark"><span className="ds-auth-mark"><i /></span><b>Vulnexa</b></span>;
}

export function AuthExperience({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(mode === "login" ? "analyst@pan.local" : "");
  const [password, setPassword] = useState(mode === "login" ? "PanAnalyst!2026" : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const storyTitle = isRegister ? "Build from a complete view." : isForgot ? "Recover secure access." : "Return to your attack surface.";
  const storyCopy = isRegister
    ? "Create your workspace, begin passive discovery, and unlock active testing only after scope verification."
    : isForgot
      ? "Request a reset link without revealing whether an account exists in the system."
      : "Continue monitoring assets, evidence, and security decisions from one continuously updated workspace.";

  const moveGlow = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pageRef.current?.style.setProperty("--auth-x", `${event.clientX - rect.left}px`);
    pageRef.current?.style.setProperty("--auth-y", `${event.clientY - rect.top}px`);
  };

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setFieldErrors({});

    if (isRegister && password !== confirmPassword) {
      setFieldErrors({ confirm: "Passphrases do not match" });
      setBusy(false);
      return;
    }

    const result = mode === "login"
      ? await loginAction({ email, password })
      : isRegister
        ? await registerAction({ name, email, password, acceptTerms })
        : await forgotPasswordAction(email);

    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.message, error: true });
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setMessage({ text: result.message, error: false });
    if (isForgot) {
      setSent(true);
      return;
    }
    router.push(isRegister ? "/onboarding/create-workspace" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="ds-auth" ref={pageRef} onPointerMove={moveGlow}>
      <div className="ds-auth-grain" aria-hidden />
      <div className="ds-auth-orbit" aria-hidden><span /><span /><span /></div>

      <header className="ds-auth-nav">
        <Link className="ds-auth-brand" href="/home" aria-label="Vulnexa home"><DeltaBrand /></Link>
        <Link className="ds-auth-back" href="/home"><ArrowLeft size={14} /> Back to site</Link>
      </header>

      <main className="ds-auth-layout">
        <section className="ds-auth-story">
          <span className="ds-auth-kicker">SECURITY STARTS WITH VISIBILITY</span>
          <h1>{storyTitle}</h1>
          <p>{storyCopy}</p>
          <div className="ds-auth-proof">
            <span><Radar size={15} /> Continuous asset discovery</span>
            <span><ShieldCheck size={15} /> Verified testing boundaries</span>
            <span><Check size={15} /> Evidence-backed analysis</span>
          </div>
        </section>

        <section className="ds-auth-card">
          <div className="ds-auth-card-head">
            <span><i /> VULNEXA / {isRegister ? "NEW WORKSPACE" : isForgot ? "ACCOUNT RECOVERY" : "SECURE ACCESS"}</span>
            <LockKeyhole size={14} />
          </div>

          {sent ? (
            <output className="ds-auth-complete">
              <span><CircleCheck size={28} /></span>
              <h2>Check your inbox.</h2>
              <p>If an account exists, recovery instructions have been sent securely.</p>
              <Link className="ds-auth-primary" href="/login">Return to login <ArrowUpRight size={16} /></Link>
            </output>
          ) : (
            <form className="ds-auth-form" onSubmit={submit} noValidate>
              <div className="ds-auth-title">
                <span>{isRegister ? "START FREE" : isForgot ? "RESET ACCESS" : "WELCOME BACK"}</span>
                <h2>{isRegister ? "Create your account" : isForgot ? "Recover your account" : "Log in to Vulnexa"}</h2>
                <p>{isRegister ? "No active scans until ownership is verified." : isForgot ? "Enter the email associated with your workspace." : "Use your organization credentials to continue."}</p>
              </div>

              {message ? (
                <div className={`ds-auth-message ${message.error ? "is-error" : "is-success"}`} role="status">
                  {message.error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}<span>{message.text}</span>
                </div>
              ) : null}

              {isRegister ? (
                <label className="ds-auth-field" htmlFor="auth-name"><span>Full name</span><input id="auth-name" type="text" autoComplete="name" placeholder="Alex Morgan" value={name} onChange={(event) => setName(event.target.value)} />{fieldErrors.name ? <small>{fieldErrors.name}</small> : null}</label>
              ) : null}

              <label className="ds-auth-field" htmlFor="auth-email"><span>Work email</span><input id="auth-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />{fieldErrors.email ? <small>{fieldErrors.email}</small> : null}</label>

              {!isForgot ? (
                <label className="ds-auth-field" htmlFor="auth-password">
                  <span>Password</span>
                  <span className="ds-auth-password"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "10+ characters" : "Your password"} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>
                  {isRegister ? <span className="ds-auth-strength"><i style={{ width: `${Math.min(100, password.length * 8)}%` }} /></span> : null}
                  {fieldErrors.password ? <small>{fieldErrors.password}</small> : null}
                </label>
              ) : null}

              {isRegister ? (
                <label className="ds-auth-field" htmlFor="auth-confirm"><span>Confirm password</span><input id="auth-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />{fieldErrors.confirm ? <small>{fieldErrors.confirm}</small> : null}</label>
              ) : null}

              {mode === "login" ? (
                <div className="ds-auth-options"><label><input type="checkbox" /> Keep me signed in</label><Link href="/forgot-password">Forgot password?</Link></div>
              ) : null}

              {isRegister ? (
                <label className="ds-auth-consent"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} /><span>I agree to use Vulnexa only for authorized security testing.</span>{fieldErrors.acceptTerms ? <small>{fieldErrors.acceptTerms}</small> : null}</label>
              ) : null}

              <button className="ds-auth-submit" type="submit" disabled={busy}>{busy ? "Processing…" : isRegister ? "Create workspace" : isForgot ? "Send reset link" : "Continue securely"} <ArrowUpRight size={17} /></button>
              <p className="ds-auth-switch">{isRegister ? <>Already have an account? <Link href="/login">Log in</Link></> : isForgot ? <Link href="/login">Back to login</Link> : <>New to Vulnexa? <Link href="/register">Create an account</Link></>}</p>
              {mode === "login" ? <div className="ds-auth-demo"><span>DEMO ACCESS</span><p>analyst@pan.local <i>/</i> PanAnalyst!2026</p></div> : null}
            </form>
          )}
        </section>
      </main>

      <footer className="ds-auth-footer"><span>© 2026 VULNEXA</span><span>AUTHORIZED USE ONLY</span></footer>
    </div>
  );
}
