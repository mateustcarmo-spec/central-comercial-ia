"use client";

import {
  Check,
  Clipboard,
  MessageCircle,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "consultant" | "assistant";
  content: string;
};

const storageKey = "central-comercial-chat";

export default function Home() {
  const [course, setCourse] = useState("");
  const [profile, setProfile] = useState("");
  const [objection, setObjection] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  const canSend = useMemo(
    () =>
      Boolean(course.trim() && profile.trim() && objection.trim()) &&
      !isLoading &&
      (!messages.length || Boolean(input.trim())),
    [course, profile, objection, input, messages.length, isLoading]
  );

  useEffect(() => {
    const storedChat = window.localStorage.getItem(storageKey);

    if (!storedChat) {
      return;
    }

    try {
      const parsed = JSON.parse(storedChat);
      setCourse(parsed.course || "");
      setProfile(parsed.profile || "");
      setObjection(parsed.objection || "");
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ course, profile, objection, messages })
    );
  }, [course, profile, objection, messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function requestAssistant(nextMessages: ChatMessage[]) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        course: course.trim(),
        profile: profile.trim(),
        objection: objection.trim(),
        messages: nextMessages.map(({ role, content }) => ({ role, content }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao gerar mensagem.");
    }

    return data.message as string;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);
    setIsLoading(true);

    const consultantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "consultant",
      content: messages.length
        ? input.trim()
        : [
            `Curso: ${course.trim()}`,
            `Perfil do lead: ${profile.trim()}`,
            `Objeção inicial: ${objection.trim()}`
          ].join("\n")
    };

    const nextMessages = [...messages, consultantMessage];
    setMessages(nextMessages);
    setInput("");

    try {
      const assistantMessage = await requestAssistant(nextMessages);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantMessage
        }
      ]);
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

  async function copyLastAnswer() {
    if (!lastAssistantMessage) {
      return;
    }

    await navigator.clipboard.writeText(lastAssistantMessage.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function clearConversation() {
    setMessages([]);
    setInput("");
    setError("");
    setCopied(false);
    window.localStorage.removeItem(storageKey);
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
              Converse com a IA para conduzir leads da UniCesumar com mensagens
              curtas, humanas e prontas para WhatsApp.
            </p>
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            Chat com API protegida
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[360px_1fr] lg:py-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-blue-700">
            <MessageCircle aria-hidden="true" className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-950">
              Contexto do lead
            </h2>
          </div>

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Curso
              </span>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="Ex.: Administração"
                className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Perfil do lead
              </span>
              <textarea
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
                placeholder="Ex.: trabalha o dia todo e quer crescer na carreira"
                rows={5}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Objeção inicial
              </span>
              <textarea
                value={objection}
                onChange={(event) => setObjection(event.target.value)}
                placeholder="Ex.: está inseguro com EAD"
                rows={4}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <button
              type="button"
              onClick={clearConversation}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Limpar conversa
            </button>
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Conversa comercial
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Envie a primeira abordagem e continue com dúvidas ou respostas
                do lead.
              </p>
            </div>
            <button
              type="button"
              onClick={copyLastAnswer}
              disabled={!lastAssistantMessage}
              className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-200 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {copied ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Clipboard aria-hidden="true" className="h-4 w-4" />
              )}
              {copied ? "Última resposta copiada" : "Copiar última resposta"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
            <div className="grid gap-4">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "assistant"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <article
                      className={`max-w-[88%] rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[76%] ${
                        message.role === "assistant"
                          ? "border-blue-100 bg-white text-slate-800"
                          : "border-blue-700 bg-blue-700 text-white"
                      }`}
                    >
                      <span
                        className={`mb-2 block text-xs font-bold uppercase ${
                          message.role === "assistant"
                            ? "text-blue-700"
                            : "text-blue-100"
                        }`}
                      >
                        {message.role === "assistant" ? "IA" : "Consultor"}
                      </span>
                      <p className="whitespace-pre-line">{message.content}</p>
                    </article>
                  </div>
                ))
              ) : (
                <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-5 text-center text-sm leading-6 text-slate-500">
                  Preencha o contexto do lead e clique em Enviar para gerar a
                  primeira abordagem.
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm">
                    Gerando resposta curta para WhatsApp...
                  </div>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-4 sm:p-5"
          >
            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  messages.length
                    ? "Digite a dúvida ou resposta do lead..."
                    : "A primeira mensagem usa o contexto inicial. Clique em Enviar."
                }
                rows={3}
                disabled={!messages.length}
                className="min-h-24 flex-1 resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:self-end"
              >
                {messages.length ? (
                  <Send aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                )}
                Enviar
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
