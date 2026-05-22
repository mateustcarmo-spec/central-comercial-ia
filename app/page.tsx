"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  BarChart3,
  Bot,
  Check,
  Clipboard,
  History,
  Lightbulb,
  LogOut,
  RotateCcw,
  Send,
  Sparkles,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "consultant" | "assistant";
  content: string;
  createdAt?: string;
};

type LeadStatus = "Frio" | "Morno" | "Quente";

type Conversation = {
  id: string;
  lead_name: string | null;
  course: string;
  profile: string;
  objection: string;
  lead_status: LeadStatus | null;
  created_at: string;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  role: "consultant" | "assistant";
  content: string;
  created_at: string;
};

type AssistantParts = {
  leadMessage: string;
  consultantTip: string;
  probingQuestion: string;
};

const statusOptions: LeadStatus[] = ["Frio", "Morno", "Quente"];
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key";
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

function extractSection(content: string, title: string, nextTitles: string[]) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedNextTitles = nextTitles
    .map((nextTitle) => nextTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const stop = escapedNextTitles ? `(?=\\n\\s*(?:${escapedNextTitles}):|$)` : "$";
  const match = content.match(
    new RegExp(`${escapedTitle}:\\s*([\\s\\S]*?)${stop}`, "i")
  );

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [leadName, setLeadName] = useState("");
  const [course, setCourse] = useState("");
  const [profile, setProfile] = useState("");
  const [objection, setObjection] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("Morno");
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
      Boolean(user) &&
      hasLeadContext &&
      !isLoading &&
      (!messages.length || Boolean(input.trim())),
    [user, hasLeadContext, input, messages.length, isLoading]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para acessar a Central.");
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    loadConversations(supabase, user.id);
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function loadConversations(client: SupabaseClient, userId: string) {
    const { data, error: queryError } = await client
      .from("conversations")
      .select("id, lead_name, course, profile, objection, lead_status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setConversations((data ?? []) as Conversation[]);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setAuthMessage("");
    setAuthLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setError(loginError.message);
    }

    setAuthLoading(false);
  }

  async function handleSignUp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha para criar a conta.");
      setAuthMessage("");
      return;
    }

    setError("");
    setAuthMessage("");
    setAuthLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setAuthMessage(
        "Conta criada com sucesso. Agora você já pode entrar com seu e-mail e senha."
      );
    }

    setAuthLoading(false);
  }

  async function handleGoogleLogin() {
    setError("");
    setAuthMessage("");

    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (googleError) {
      setError(googleError.message);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setError("Informe seu e-mail para receber o link de recuperação.");
      setAuthMessage("");
      return;
    }

    setError("");
    setAuthMessage("");
    setAuthLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin
      }
    );

    if (resetError) {
      setError(resetError.message);
    } else {
      setAuthMessage("Enviamos um link de recuperação para o seu e-mail.");
    }

    setAuthLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setConversationId("");
    setConversations([]);
    resetConversationForm();
  }

  async function createConversation() {
    if (!user) {
      throw new Error("Faça login para iniciar uma conversa.");
    }

    const payload = {
      user_id: user.id,
      lead_name: leadName.trim() || null,
      course: course.trim(),
      profile: profile.trim(),
      objection: objection.trim(),
      lead_status: leadStatus
    };

    const { data, error: insertError } = await supabase
      .from("conversations")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    setConversationId(data.id);
    await loadConversations(supabase, user.id);

    return data.id as string;
  }

  async function saveMessage(
    activeConversationId: string,
    role: ChatMessage["role"],
    content: string
  ) {
    if (!user) {
      throw new Error("Faça login para salvar mensagens.");
    }

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role,
        content
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId)
      .eq("user_id", user.id);

    return data as { id: string; created_at: string };
  }

  async function openConversation(conversation: Conversation) {
    if (!user) {
      return;
    }

    setError("");
    setConversationId(conversation.id);
    setLeadName(conversation.lead_name || "");
    setCourse(conversation.course || "");
    setProfile(conversation.profile || "");
    setObjection(conversation.objection || "");
    setLeadStatus(conversation.lead_status || "Morno");

    const { data, error: queryError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setMessages(
      ((data ?? []) as MessageRow[]).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at
      }))
    );
  }

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

    try {
      const activeConversationId = conversationId || (await createConversation());
      const consultantContent = messages.length
        ? input.trim()
        : `Iniciar conversa com ${leadName.trim() || "o lead"} sobre ${course.trim()}.`;
      const savedConsultantMessage = await saveMessage(
        activeConversationId,
        "consultant",
        consultantContent
      );
      const consultantMessage: ChatMessage = {
        id: savedConsultantMessage.id,
        role: "consultant",
        content: consultantContent,
        createdAt: savedConsultantMessage.created_at
      };
      const nextMessages = [...messages, consultantMessage];

      setMessages(nextMessages);
      setInput("");

      const assistantContent = await requestAssistant(nextMessages);
      const savedAssistantMessage = await saveMessage(
        activeConversationId,
        "assistant",
        assistantContent
      );

      setMessages((current) => [
        ...current,
        {
          id: savedAssistantMessage.id,
          role: "assistant",
          content: assistantContent,
          createdAt: savedAssistantMessage.created_at
        }
      ]);

      if (user) {
        await loadConversations(supabase, user.id);
      }
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

  function resetConversationForm() {
    setLeadName("");
    setCourse("");
    setProfile("");
    setObjection("");
    setLeadStatus("Morno");
    setConversationId("");
    setMessages([]);
    setInput("");
    setError("");
    setCopied(false);
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e5ddd5] px-5 text-slate-700">
        Carregando Central Comercial IA EAD...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e5ddd5] px-5">
        <form
          onSubmit={authMode === "login" ? handleLogin : handleSignUp}
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft"
        >
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Central Comercial IA EAD
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            {authMode === "login" ? "Acesse sua conta" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {authMode === "login"
              ? "Entre para salvar conversas e continuar atendimentos antigos."
              : "Cadastre seu acesso para manter seu histórico comercial salvo."}
          </p>

          <div className="mt-6 grid gap-4">
            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                  setAuthMessage("");
                }}
                className={`min-h-10 rounded px-3 text-sm font-bold transition ${
                  authMode === "login"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setError("");
                  setAuthMessage("");
                }}
                className={`min-h-10 rounded px-3 text-sm font-bold transition ${
                  authMode === "signup"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Criar conta
              </button>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                E-mail
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="min-h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-800">
                Senha
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="min-h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            {authMode === "login" ? (
              <button
                type="button"
                onClick={handlePasswordReset}
                className="justify-self-start text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
              >
                Esqueci minha senha
              </button>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {authMessage ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {authMessage}
              </div>
            ) : null}

            <button
              type="submit"
              className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              {authMode === "login" ? null : (
                <UserPlus aria-hidden="true" className="h-4 w-4" />
              )}
              {authMode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <div className="flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              ou
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="min-h-12 rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Continuar com Google
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e5ddd5]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-0 bg-slate-100 lg:grid-cols-[380px_1fr] lg:p-5">
        <aside className="order-2 border-r border-slate-200 bg-white p-5 lg:order-1 lg:rounded-l-lg lg:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-emerald-700">
                Central Comercial IA EAD
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950">
                Contexto do Lead
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/dashboard"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                title="Dashboard"
              >
                <BarChart3 aria-hidden="true" className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                title="Sair"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
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

          <section className="mt-8 border-t border-slate-200 pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <History aria-hidden="true" className="h-5 w-5 text-emerald-700" />
                Histórico
              </h2>
              <button
                type="button"
                onClick={resetConversationForm}
                className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
              >
                Nova
              </button>
            </div>

            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {conversations.length ? (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className={`rounded-md border p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 ${
                      conversation.id === conversationId
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {conversation.lead_name || "Lead sem nome"}
                    </span>
                    <span className="mt-1 block truncate text-sm text-slate-600">
                      {conversation.course}
                    </span>
                    <span className="mt-2 block text-xs font-medium text-slate-400">
                      {formatDate(conversation.updated_at || conversation.created_at)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-4 py-5 text-sm leading-6 text-slate-500">
                  Suas conversas salvas aparecerão aqui.
                </div>
              )}
            </div>
          </section>
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
                onClick={resetConversationForm}
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
