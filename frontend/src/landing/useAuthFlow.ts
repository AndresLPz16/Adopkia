import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, readJson } from "./api";
import type { AuthResponse, LoginMathChallenge } from "./api";

export type LandingView = "catalog" | "login" | "register" | "verify-email";

// Estado y acciones del registro, la verificación de correo y el login.
// Vive en Landing para que lo escrito se conserve al volver al catálogo.
export function useAuthFlow() {
  const [view, setView] = useState<LandingView>("catalog");
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
    phone: "",
    role: "adoptante",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mathChallenge, setMathChallenge] = useState<LoginMathChallenge | null>(null);
  const [mathAnswer, setMathAnswer] = useState("");
  const [challengeRefresh, setChallengeRefresh] = useState(0);

  const update = (name: string, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const showAuthentication = (nextView: "login" | "register") => {
    setError("");
    setAuthNotice("");
    setView(nextView);
  };

  useEffect(() => {
    if (view !== "login") {
      setMathChallenge(null);
      setMathAnswer("");
      return;
    }

    const controller = new AbortController();
    setMathChallenge(null);
    setMathAnswer("");
    void (async () => {
      try {
        const data = await readJson(
          await fetch("/api/v1/auth/login-challenge/", {
            signal: controller.signal,
          }),
        );
        if (
          !data ||
          typeof data !== "object" ||
          !("challenge_id" in data) ||
          typeof data.challenge_id !== "string" ||
          !("question" in data) ||
          typeof data.question !== "string"
        ) {
          throw new Error("No se pudo cargar el reto de seguridad.");
        }
        setMathChallenge({
          challenge_id: data.challenge_id,
          question: data.question,
        });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el reto de seguridad.",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [view, challengeRefresh]);

  async function resendVerificationCode() {
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      const response = await readJson(
        await fetch("/api/v1/auth/resend-email-verification/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email }),
        }),
      );
      setAuthNotice(
        response && typeof response === "object" && "detail" in response &&
          typeof response.detail === "string"
          ? response.detail
          : "Si la cuenta necesita verificación, recibirás un código por correo.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo solicitar otro código.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      if (view === "register") {
        await readJson(
          await fetch("/api/v1/auth/register/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              username: form.username,
              password: form.password,
              name: form.name,
              phone: form.phone || null,
              role: form.role,
            }),
          }),
        );
        setVerificationCode("");
        setAuthNotice(
          "Enviamos un código a tu correo. Ingresa los seis dígitos para verificar tu cuenta.",
        );
        setView("verify-email");
        return;
      }

      if (view === "verify-email") {
        await readJson(
          await fetch("/api/v1/auth/verify-email/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              code: verificationCode,
            }),
          }),
        );
        setForm((current) => ({ ...current, password: "" }));
        setAuthNotice("Correo verificado. Ya puedes iniciar sesión.");
        setView("login");
        return;
      }

      if (!mathChallenge) {
        throw new Error("Espera a que cargue el reto matemático.");
      }
      const login = (await readJson(
        await fetch("/api/v1/auth/login/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: form.email,
            password: form.password,
            challenge_id: mathChallenge.challenge_id,
            challenge_answer: mathAnswer,
          }),
        }),
      )) as AuthResponse;
      if (!login || typeof login.access !== "string") {
        throw new Error("El servidor no devolvió un token de acceso válido.");
      }
      window.localStorage.setItem(ACCESS_TOKEN_KEY, login.access);
      if (typeof login.refresh === "string") {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, login.refresh);
      }
      window.location.assign("/app/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la solicitud. Inténtalo de nuevo.",
      );
      if (view === "login") {
        setChallengeRefresh((current) => current + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    view,
    setView,
    form,
    update,
    busy,
    error,
    setError,
    authNotice,
    verificationCode,
    setVerificationCode,
    mathChallenge,
    mathAnswer,
    setMathAnswer,
    showAuthentication,
    resendVerificationCode,
    submit,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
