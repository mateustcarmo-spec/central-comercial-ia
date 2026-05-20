"use client";

import {
  Bot,
  Check,
  Clipboard,
  Lightbulb,
  RotateCcw,
  Send,
  Sparkles
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "consultant" | "assistant";
  content: string;
  createdAt?: string;
};

type LeadStatus = "Frio" | "Morno" | "Quente";

type AssistantParts = {
  leadMessage: string;
  consultantTip: string;
  probingQuestion: string;
};

const storageKey = "central-comercial-chat";
const statusOptions: LeadStatus[] = ["Frio", "Morno", "Quente"];

function extractSection(content: string, title: string, nextTitles: string[]) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedNextTitles = nextTitles
    .map((nextTitle) => nextTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const stop = escapedNextTitles ? `(?=\\n\\s*(?:${escapedNextTitles}):|$)` : "$";
  const match = content.match(new RegExp(`${escapedTitle}:\\s*([\\s\\S]*?)${stop}`, "i"));

  return match?.[1]?.trim() || "";
}

function parseAssistantResponse(content: string): AssistantParts {
  const leadMessage = extractSection(content, "Mensagem para o lead", [
    "Dica para o consultor",
    "Dica para o vendedor",
    "Pergunta de sondagem"
  ]);
  const consultantTip =
    extractSection(content, "Dica para o consultor", [
      "Pergunta de sondagem"
    ]) ||
    extractSection(content, "Dica para o vendedor", ["Pergunta de sondagem"]);
  const probingQuestion = extractSection(content, "Pergunta de sondagem", []);

  return {
    leadMessage: leadMessage || content,
    consultantTip,
    probingQuestion
  };
}

function formatTime(value?: string) {
  const date = value ? new Date(value) : new Date();

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function Home() {
  const [leadName, setLeadName] = useState("");
  const [course, setCourse] = useState("");
  const [profile, setProfile] = useState("");
  const [objection, setObjection] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("Morno");
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

  const hasLeadContext = useMemo(
    () => Boolean(course.trim() && profile.trim() && objection.trim()),
    [course, profile, objection]
  );

  const canSend = useMemo(
    () =>
      hasLeadContext &&
      !isLoading &&
      (!messages.length || Boolean(input.trim())),
    [hasLeadContext, input, messages.length, isLoading]
  );

  useEffect(() => {
    const storedChat = window.localStorage.getItem(storageKey);

    if (!storedChat) {
      return;
    }

    try {
      const parsed = JSON.parse(storedChat);
      setLeadName(parsed.leadName || "");
      setCourse(parsed.course || "");
      setProfile(parsed.profile || "");
      setObjection(parsed.objection || "");
      setLeadStatus(statusOptions.includes(parsed.leadStatus) ? parsed.leadStatus : "Morno");
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        leadName,
        course,
        profile,
        objection,
        leadStatus,
        messages
      })
    );
  }, [leadName, course, profile, objection, leadStatus, messages]);

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
        leadName: leadName.trim(),
        course: course.trim(),
        profile: profile.trim(),
        objection: objection.trim(),
        leadStatus,
        messages: nextMessages.map(({ role, content }) => ({ role, content }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao gerar mensagem.");
    }

    return data.message as string;
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!canSend) {
      return;
    }

    setError("");
    setCopied(false);
    setIsLoading(true);

    const consultantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "consultant",
      createdAt: new Date().toISOString(),
      content: messages.length
        ? input.trim()
        : `Iniciar conversa com ${leadName.trim() || "o lead"} sobre ${course.trim()}.`
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
          content: assistantMessage,
          createdAt: new Date().toISOString()
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

    const { leadMessage } = parseAssistantResponse(lastAssistantMessage.content);
    await navigator.clipboard.writeText(leadMessage);
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
    <main className="min-h-screen bg-[#e5ddd5]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-0 bg-slate-100 lg:grid-cols-[380px_1fr] lg:p-5">
        <aside className="order-2 border-r border-slate-200 bg-white p-5 lg:order-1 lg:rounded-l-lg lg:p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Central Comercial IA EAD
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950">
              Contexto do Lead
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Informe os dados comerciais para a IA orientar a conversa com
              sondagem e conexão.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Nome do lead
              </span>
              <input
                value={leadName}
                onChange={(event) => setLeadName(event.target.value)}
                placeholder="Ex.: Ana Paula"
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Curso
              </span>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="Ex.: Administração"
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
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
                rows={4}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
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
                rows={3}
                className="resize-none rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Status do lead
              </span>
              <select
                value={leadStatus}
                onChange={(event) => setLeadStatus(event.target.value as LeadStatus)}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!canSend || Boolean(messages.length)}
              className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Iniciar conversa
            </button>
          </div>
        </aside>

        <section className="order-1 flex min-h-screen flex-col bg-[#efe7dd] lg:order-2 lg:min-h-[calc(100vh-40px)] lg:rounded-r-lg">
          <header className="flex items-center justify-between gap-3 border-b border-slate-300 bg-[#f0f2f5] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Bot aria-hidden="true" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-950">
                  Consultor IA Comercial
                </h2>
                <p className="text-sm font-medium text-emerald-700">
                  online agora
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={copyLastAnswer}
              disabled={!lastAssistantMessage}
              className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {copied ? (
                <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clipboard aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copiada" : "Copiar última resposta"}
              </span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto grid max-w-4xl gap-4">
              {messages.length ? (
                messages.map((message) => {
                  const assistantParts =
                    message.role === "assistant"
                      ? parseAssistantResponse(message.content)
                      : null;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "assistant"
                          ? "justify-start"
                          : "justify-end"
                      }`}
                    >
                      <article
                        className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[74%] ${
                          message.role === "assistant"
                            ? "rounded-tl-sm bg-white text-slate-800"
                            : "rounded-tr-sm bg-[#dcf8c6] text-slate-900"
                        }`}
                      >
                        {assistantParts ? (
                          <div className="grid gap-3">
                            <div>
                              <span className="mb-1 block text-xs font-bold uppercase text-emerald-700">
                                Mensagem para o lead
                              </span>
                              <p className="whitespace-pre-line">
                                {assistantParts.leadMessage}
                              </p>
                            </div>

                            {assistantParts.consultantTip ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                                <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-amber-700">
                                  <Lightbulb
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                  />
                                  Dica para o consultor
                                </span>
                                <p>{assistantParts.consultantTip}</p>
                              </div>
                            ) : null}

                            {assistantParts.probingQuestion ? (
                              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950">
                                <span className="mb-1 block text-xs font-bold uppercase text-sky-700">
                                  Pergunta de sondagem
                                </span>
                                <p>{assistantParts.probingQuestion}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="whitespace-pre-line">{message.content}</p>
                        )}
                        <time
                          className={`mt-2 block text-right text-[11px] ${
                            message.role === "assistant"
                              ? "text-slate-400"
                              : "text-emerald-900/60"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </time>
                      </article>
                    </div>
                  );
                })
              ) : (
                <div className="mx-auto mt-8 max-w-md rounded-lg bg-white/85 px-5 py-6 text-center text-sm leading-6 text-slate-600 shadow-sm">
                  Preencha o contexto do lead e inicie a conversa para receber
                  mensagem, dica prática e pergunta de sondagem.
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm">
                    Consultor IA está digitando...
                  </div>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-300 bg-[#f0f2f5] p-3 sm:p-4"
          >
            {error ? (
              <div className="mx-auto mb-3 max-w-4xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <button
                type="button"
                onClick={clearConversation}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:text-red-600"
                title="Limpar conversa"
              >
                <RotateCcw aria-hidden="true" className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Digite a resposta ou dúvida do lead..."
                rows={1}
                disabled={!messages.length}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-transparent bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-5"
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
