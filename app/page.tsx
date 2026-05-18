"use client";

import { Check, Clipboard, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type HistoryItem = {
  id: string;
  course: string;
  message: string;
};

const initialHistory: HistoryItem[] = [];

export default function Home() {
  const [course, setCourse] = useState("");
  const [profile, setProfile] = useState("");
  const [objection, setObjection] = useState("");
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedHistory = window.localStorage.getItem(
      "central-comercial-history"
    );

    try {
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch {
      window.localStorage.removeItem("central-comercial-history");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "central-comercial-history",
      JSON.stringify(history)
    );
  }, [history]);

  const canSubmit = useMemo(
    () =>
      Boolean(course.trim() && profile.trim() && objection.trim()) &&
      !isLoading,
    [course, profile, objection, isLoading]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          course: course.trim(),
          profile: profile.trim(),
          objection: objection.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao gerar mensagem.");
      }

      setAnswer(data.message);
      setHistory((current) =>
        [
          {
            id: crypto.randomUUID(),
            course: course.trim(),
            message: data.message
          },
          ...current
        ].slice(0, 5)
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível gerar a abordagem."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyAnswer() {
    if (!answer) {
      return;
    }

    await navigator.clipboard.writeText(answer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">
              Comercial EAD
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
              Central Comercial IA EAD
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Gere abordagens curtas, humanas e prontas para WhatsApp a partir
              do curso, perfil do lead e principal objeção.
            </p>
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            API protegida no servidor
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:py-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-6"
        >
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Curso
              </span>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="Ex.: Administração, Pedagogia, Gestão Comercial"
                className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Perfil do Lead
              </span>
              <textarea
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
                placeholder="Ex.: trabalha o dia todo, quer mudar de área, tem pouco tempo para estudar"
                rows={4}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Objeção
              </span>
              <textarea
                value={objection}
                onChange={(event) => setObjection(event.target.value)}
                placeholder="Ex.: acha caro, está inseguro com EAD, quer pensar mais"
                rows={3}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {isLoading ? "Gerando abordagem..." : "Gerar abordagem"}
            </button>
          </div>
        </form>

        <div className="grid gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-slate-950">
                Resposta da IA
              </h2>
              <button
                type="button"
                onClick={copyAnswer}
                disabled={!answer}
                className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-200 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                {copied ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Clipboard aria-hidden="true" className="h-4 w-4" />
                )}
                {copied ? "Mensagem copiada" : "Copiar mensagem"}
              </button>
            </div>

            <div className="mt-5 min-h-48 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 p-4 text-base leading-7 text-slate-800">
              {answer ||
                "A mensagem gerada aparecerá aqui, pronta para enviar ao lead."}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Histórico recente
            </h2>
            <div className="mt-4 grid gap-3">
              {history.length ? (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAnswer(item.message)}
                    className="rounded-md border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="block text-sm font-bold text-blue-700">
                      {item.course}
                    </span>
                    <span className="mt-2 line-clamp-3 block whitespace-pre-line text-sm leading-6 text-slate-600">
                      {item.message}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-sm leading-6 text-slate-500">
                  As últimas respostas geradas ficarão disponíveis aqui durante
                  esta sessão.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
