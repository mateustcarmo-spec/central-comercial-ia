"use client";

import { createClient, type User } from "@supabase/supabase-js";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Flame,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Search,
  Sparkles,
  Users
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type PeriodKey = "today" | "7d" | "30d";
type LeadStatus = "Frio" | "Morno" | "Quente";

type ConversationRow = {
  id: string;
  user_id: string;
  lead_name: string | null;
  course: string | null;
  profile: string | null;
  objection: string | null;
  lead_status: string | null;
  created_at: string;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  role: "consultant" | "assistant";
  content: string;
  created_at: string;
};

type RankingRow = {
  id: string;
  name: string;
  conversations: number;
  messages: number;
  score: number;
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key";
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const periodOptions: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 }
];

const leadColors: Record<LeadStatus, string> = {
  Frio: "#38bdf8",
  Morno: "#f59e0b",
  Quente: "#10b981"
};

function getPeriodStart(period: PeriodKey) {
  const now = new Date();

  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  const option = periodOptions.find((item) => item.key === period);
  now.setDate(now.getDate() - ((option?.days ?? 7) - 1));
  now.setHours(0, 0, 0, 0);

  return now.toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function collaboratorName(userId: string, user: User | null, index: number) {
  if (user?.id === userId) {
    return user.email || "Você";
  }

  return `Colaborador ${index + 1}`;
}

function normalizeLeadStatus(value: string | null): LeadStatus {
  const normalized = (value || "Morno").toLowerCase();

  if (normalized.includes("frio")) {
    return "Frio";
  }

  if (normalized.includes("quente")) {
    return "Quente";
  }

  return "Morno";
}

function topItems(items: (string | null)[], fallback: string) {
  const count = new Map<string, number>();

  items.forEach((item) => {
    const key = item?.trim() || fallback;
    count.set(key, (count.get(key) || 0) + 1);
  });

  return Array.from(count.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para acessar o dashboard.");
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
      setMessages([]);
      return;
    }

    const periodStart = getPeriodStart(period);
    setError("");
    setLoadingData(true);

    Promise.all([
      supabase
        .from("conversations")
        .select(
          "id, user_id, lead_name, course, profile, objection, lead_status, created_at, updated_at"
        )
        .gte("created_at", periodStart)
        .order("updated_at", { ascending: false }),
      supabase
        .from("messages")
        .select("id, user_id, conversation_id, role, content, created_at")
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false })
    ])
      .then(([conversationResult, messageResult]) => {
        if (conversationResult.error) {
          throw new Error(conversationResult.error.message);
        }

        if (messageResult.error) {
          throw new Error(messageResult.error.message);
        }

        setConversations((conversationResult.data ?? []) as ConversationRow[]);
        setMessages((messageResult.data ?? []) as MessageRow[]);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o dashboard."
        );
      })
      .finally(() => setLoadingData(false));
  }, [period, user]);

  const analytics = useMemo(() => {
    const userIds = Array.from(
      new Set([
        ...conversations.map((conversation) => conversation.user_id),
        ...messages.map((message) => message.user_id)
      ])
    );

    const names = new Map(
      userIds.map((userId, index) => [
        userId,
        collaboratorName(userId, user, index)
      ])
    );

    const ranking: RankingRow[] = userIds
      .map((userId) => {
        const conversationCount = conversations.filter(
          (conversation) => conversation.user_id === userId
        ).length;
        const messageCount = messages.filter(
          (message) => message.user_id === userId
        ).length;

        return {
          id: userId,
          name: names.get(userId) || "Colaborador",
          conversations: conversationCount,
          messages: messageCount,
          score: conversationCount * 2 + messageCount
        };
      })
      .sort((a, b) => b.score - a.score);

    const messagesByCollaborator = ranking.map((row) => ({
      name: row.name,
      mensagens: row.messages
    }));

    const conversationsByCollaborator = ranking.map((row) => ({
      name: row.name,
      conversas: row.conversations
    }));

    const courses = topItems(
      conversations.map((conversation) => conversation.course),
      "Curso não informado"
    );

    const objections = topItems(
      conversations.map((conversation) => conversation.objection),
      "Objeção não informada"
    );

    const leadStatus = (["Frio", "Morno", "Quente"] as LeadStatus[]).map(
      (status) => ({
        name: status,
        value: conversations.filter(
          (conversation) => normalizeLeadStatus(conversation.lead_status) === status
        ).length
      })
    );

    const assistantMessages = messages.filter(
      (message) => message.role === "assistant"
    ).length;
    const averageMessages =
      conversations.length > 0 ? messages.length / conversations.length : 0;

    return {
      totalUsers: userIds.length,
      totalConversations: conversations.length,
      totalMessages: messages.length,
      ranking,
      activeCollaborator: ranking[0]?.name || "Sem dados",
      averageMessages,
      assistantMessages,
      courses,
      objections,
      leadStatus,
      messagesByCollaborator,
      conversationsByCollaborator,
      latestConversations: conversations.slice(0, 6)
    };
  }, [conversations, messages, user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 text-slate-700">
        Carregando dashboard...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e5ddd5] px-5">
        <section className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <BarChart3 aria-hidden="true" className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Dashboard protegido
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Entre na Central Comercial IA para visualizar indicadores,
            rankings e atendimentos.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            Entrar na Central
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e5ddd5] text-slate-950">
      <section className="mx-auto min-h-screen w-full max-w-7xl bg-slate-50 lg:p-5">
        <div className="grid min-h-screen bg-white lg:min-h-[calc(100vh-40px)] lg:grid-cols-[260px_1fr] lg:rounded-lg lg:shadow-soft">
          <aside className="border-b border-slate-200 bg-[#f0f2f5] p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div className="flex items-start justify-between gap-3 lg:block">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Central Comercial IA
                </p>
                <h1 className="mt-2 text-2xl font-bold">Dashboard</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Visão gerencial de conversas, leads e uso da IA.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 lg:mt-8"
                title="Sair"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 grid gap-2">
              <Link
                href="/"
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700"
              >
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                Chat Comercial
              </Link>
              <span className="flex min-h-11 items-center gap-3 rounded-md bg-white px-3 text-sm font-bold text-emerald-700 shadow-sm">
                <BarChart3 aria-hidden="true" className="h-5 w-5" />
                Dashboard
              </span>
            </nav>

            <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-950">
                Filtro por período
              </p>
              <div className="mt-3 grid gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriod(option.key)}
                    className={`min-h-10 rounded-md px-3 text-left text-sm font-bold transition ${
                      period === option.key
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-600 hover:text-emerald-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 bg-slate-50">
            <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:rounded-tr-lg lg:px-7">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  {periodOptions.find((option) => option.key === period)?.label}
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  Painel gerencial comercial
                </h2>
              </div>
              <div className="rounded-md bg-[#dcf8c6] px-4 py-3 text-sm font-bold text-emerald-950">
                {user.email}
              </div>
            </header>

            <div className="grid gap-5 p-5 lg:p-7">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label="Total de usuários"
                  value={compactNumber(analytics.totalUsers)}
                />
                <MetricCard
                  icon={<MessagesSquare className="h-5 w-5" />}
                  label="Total de conversas"
                  value={compactNumber(analytics.totalConversations)}
                />
                <MetricCard
                  icon={<MessageCircle className="h-5 w-5" />}
                  label="Total de mensagens"
                  value={compactNumber(analytics.totalMessages)}
                />
                <MetricCard
                  icon={<Flame className="h-5 w-5" />}
                  label="Colaborador mais ativo"
                  value={analytics.activeCollaborator}
                />
                <MetricCard
                  icon={<Activity className="h-5 w-5" />}
                  label="Média de mensagens por conversa"
                  value={analytics.averageMessages.toFixed(1)}
                />
                <MetricCard
                  icon={<Bot className="h-5 w-5" />}
                  label="Total de atendimentos IA"
                  value={compactNumber(analytics.assistantMessages)}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <Panel
                  title="Ranking de colaboradores por uso"
                  subtitle="Pontuação considera conversas e mensagens no período."
                >
                  <div className="grid gap-3">
                    {analytics.ranking.length ? (
                      analytics.ranking.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[36px_1fr_auto] sm:items-center"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">
                              {row.name}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {row.conversations} conversas · {row.messages} mensagens
                            </p>
                          </div>
                          <strong className="text-lg text-emerald-700">
                            {row.score}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="Sem colaboradores no período." />
                    )}
                  </div>
                </Panel>

                <Panel title="Leads frios, mornos e quentes">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.leadStatus}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={4}
                        >
                          {analytics.leadStatus.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={leadColors[entry.name as LeadStatus]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Conversas por colaborador">
                  <ChartFrame>
                    <BarChart data={analytics.conversationsByCollaborator}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar
                        dataKey="conversas"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ChartFrame>
                </Panel>

                <Panel title="Mensagens por colaborador">
                  <ChartFrame>
                    <LineChart data={analytics.messagesByCollaborator}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="mensagens"
                        stroke="#059669"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#059669" }}
                      />
                    </LineChart>
                  </ChartFrame>
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <Panel title="Últimas conversas">
                  <div className="grid gap-3">
                    {analytics.latestConversations.length ? (
                      analytics.latestConversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="rounded-md border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">
                                {conversation.lead_name || "Lead sem nome"}
                              </p>
                              <p className="truncate text-sm text-slate-500">
                                {conversation.course || "Curso não informado"}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                              {normalizeLeadStatus(conversation.lead_status)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-medium text-slate-400">
                            {formatDate(conversation.updated_at || conversation.created_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="Nenhuma conversa encontrada." />
                    )}
                  </div>
                </Panel>

                <Panel title="Cursos mais consultados">
                  <RankList data={analytics.courses} icon={<Search className="h-4 w-4" />} />
                </Panel>

                <Panel title="Objeções mais comuns">
                  <RankList
                    data={analytics.objections}
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                </Panel>
              </div>

              {loadingData ? (
                <div className="fixed bottom-5 right-5 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-soft">
                  Atualizando dados...
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <strong className="mt-1 block truncate text-2xl font-bold text-slate-950">
        {value}
      </strong>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function RankList({
  data,
  icon
}: {
  data: { name: string; total: number }[];
  icon: React.ReactNode;
}) {
  if (!data.length) {
    return <EmptyState text="Sem dados para listar." />;
  }

  const max = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div key={item.name} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                {icon}
              </span>
              <p className="truncate text-sm font-bold text-slate-900">
                {item.name}
              </p>
            </div>
            <strong className="text-sm text-emerald-700">{item.total}</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}
