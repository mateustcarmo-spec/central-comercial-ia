"use client";

import { createClient, type User } from "@supabase/supabase-js";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Clock,
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
import { SystemFooter } from "../components/SystemFooter";
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
type UserRole = "admin" | "consultor";
type InstitutionKey = "unicesumar" | "unifecaf";
type InstitutionFilter = InstitutionKey | "all";

type ConversationRow = {
  id: string;
  user_id: string;
  institution: InstitutionKey | null;
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

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole | null;
  profile_type?: UserRole | null;
  institution: InstitutionKey | null;
  access_count: number | null;
  last_access_at: string | null;
  ai_model: string | null;
};

type RankingRow = {
  id: string;
  name: string;
  role: UserRole | null;
  accesses: number;
  lastAccess: string | null;
  leads: number;
  conversations: number;
  messages: number;
  aiMessages: number;
  aiModel: string;
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
const profileSelect =
  "id, email, display_name, role, profile_type, institution, access_count, last_access_at, ai_model";

const legacyStorageKeys = [
  "role",
  "userRole",
  "profile",
  "currentProfile",
  "supabase.auth.role",
  "central-comercial-role"
];

const periodOptions: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 }
];
const institutionOptions: { key: InstitutionKey; label: string }[] = [
  { key: "unicesumar", label: "UniCesumar" },
  { key: "unifecaf", label: "UniFECAF" }
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

function clearLegacyAuthCache() {
  if (typeof window === "undefined") {
    return;
  }

  legacyStorageKeys.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  return role === "admin" || role === "consultor" ? role : null;
}

function profileRole(profile: ProfileRow | null | undefined): UserRole | null {
  return normalizeRole(profile?.role) ?? normalizeRole(profile?.profile_type);
}

function isProfileAdmin(profile: ProfileRow | null | undefined) {
  return profileRole(profile) === "admin";
}

function roleLabel(role: UserRole | null | undefined) {
  return role === "admin" || role === "consultor" ? role : "";
}

function normalizeInstitution(value: string | null | undefined): InstitutionKey {
  return value === "unifecaf" ? "unifecaf" : "unicesumar";
}

function institutionLabel(institution: InstitutionFilter | null | undefined) {
  if (institution === "all") {
    return "Todas";
  }

  return (
    institutionOptions.find((option) => option.key === institution)?.label ||
    "UniCesumar"
  );
}

function dashboardTheme(institution: InstitutionFilter) {
  if (institution === "unifecaf") {
    return {
      page: "bg-[#eef2ff]",
      accentText: "text-violet-700",
      primary: "bg-emerald-600 text-white",
      active: "bg-emerald-600 text-white",
      soft: "border-violet-100 bg-violet-50",
      chartA: "#7c3aed",
      chartB: "#10b981",
      chartC: "#0ea5e9"
    };
  }

  if (institution === "unicesumar") {
    return {
      page: "bg-[#e8f1fb]",
      accentText: "text-blue-700",
      primary: "bg-blue-700 text-white",
      active: "bg-blue-700 text-white",
      soft: "border-amber-100 bg-amber-50",
      chartA: "#1d4ed8",
      chartB: "#f59e0b",
      chartC: "#0ea5e9"
    };
  }

  return {
    page: "bg-slate-100",
    accentText: "text-emerald-700",
    primary: "bg-emerald-600 text-white",
    active: "bg-emerald-600 text-white",
    soft: "border-emerald-100 bg-emerald-50",
    chartA: "#0ea5e9",
    chartB: "#f59e0b",
    chartC: "#10b981"
  };
}

function profileDisplayName(profile: ProfileRow | null | undefined) {
  const displayName = profile?.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  return profile?.email?.trim() || "";
}

function collaboratorName(
  userId: string,
  user: User | null,
  profiles: Map<string, ProfileRow>
) {
  const profile = profiles.get(userId);
  const profileName = profileDisplayName(profile);

  if (profileName) {
    return profileName;
  }

  return user?.id === userId ? user.email || userId : userId;
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

async function loadOrCreateCurrentProfile(user: User) {
  const email = user.email?.trim() || null;
  const displayName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    null;
  const institution = normalizeInstitution(user.user_metadata?.institution);
  const profileQuery = supabase
    .from("profiles")
    .select(profileSelect)
    .or(email ? `id.eq.${user.id},email.eq.${email}` : `id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  const { data, error } = await profileQuery;

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    const profile = data as ProfileRow;

    if (!profile.display_name?.trim() && displayName) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", profile.id)
        .select(profileSelect)
        .single();

      if (!updateError && updatedProfile) {
        return updatedProfile as ProfileRow;
      }
    }

    return profile;
  }

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email,
      display_name: displayName,
      institution,
      role: "consultor",
      last_access_at: new Date().toISOString()
    })
    .select(profileSelect)
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return createdProfile as ProfileRow;
}

function mergeProfiles(...profileGroups: ProfileRow[][]) {
  const profilesById = new Map<string, ProfileRow>();

  profileGroups.flat().forEach((profile) => {
    profilesById.set(profile.id, {
      ...profilesById.get(profile.id),
      ...profile
    });
  });

  return Array.from(profilesById.values());
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [institutionFilter, setInstitutionFilter] =
    useState<InstitutionFilter>("all");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para acessar o dashboard.");
      setAuthLoading(false);
      return;
    }

    clearLegacyAuthCache();

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
      setCurrentProfile(null);
      setProfiles([]);
      setConversations([]);
      setMessages([]);
      return;
    }

    const periodStart = getPeriodStart(period);
    const activeUser = user;
    const userId = user.id;
    setError("");
    setLoadingData(true);

    async function loadDashboardData() {
      await supabase.rpc("register_profile_access").then(() => undefined);
      const currentUserProfile = await loadOrCreateCurrentProfile(activeUser);
      const isCurrentUserAdmin = isProfileAdmin(currentUserProfile);
      const selectedInstitution: InstitutionFilter = isCurrentUserAdmin
        ? institutionFilter
        : normalizeInstitution(currentUserProfile.institution);

      let profileListQuery = supabase
        .from("profiles")
        .select(profileSelect)
        .order("email", { ascending: true });
      let conversationQuery = supabase
        .from("conversations")
        .select(
          "id, user_id, institution, lead_name, course, profile, objection, lead_status, created_at, updated_at"
        )
        .gte("created_at", periodStart)
        .order("updated_at", { ascending: false });
      let messageQuery = supabase
        .from("messages")
        .select("id, user_id, conversation_id, role, content, created_at")
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false });

      if (!isCurrentUserAdmin) {
        profileListQuery = profileListQuery.eq("id", userId);
        conversationQuery = conversationQuery
          .eq("user_id", userId)
          .eq("institution", selectedInstitution);
        messageQuery = messageQuery.eq("user_id", userId);
      } else if (selectedInstitution !== "all") {
        profileListQuery = profileListQuery.eq("institution", selectedInstitution);
        conversationQuery = conversationQuery.eq("institution", selectedInstitution);
      }

      const [profileListResult, conversationResult, messageResult] =
        await Promise.all([profileListQuery, conversationQuery, messageQuery]);

      if (profileListResult.error) {
        throw new Error(profileListResult.error.message);
      }

      if (conversationResult.error) {
        throw new Error(conversationResult.error.message);
      }

      if (messageResult.error) {
        throw new Error(messageResult.error.message);
      }

      const loadedConversations = (conversationResult.data ?? []) as ConversationRow[];
      const conversationIds = new Set(
        loadedConversations.map((conversation) => conversation.id)
      );
      const loadedMessages = ((messageResult.data ?? []) as MessageRow[]).filter(
        (message) => conversationIds.has(message.conversation_id)
      );
      const loadedProfiles = (profileListResult.data ?? []) as ProfileRow[];
      const loadedProfileIds = new Set(loadedProfiles.map((profile) => profile.id));
      const dataUserIds = Array.from(
        new Set([
          ...loadedConversations.map((conversation) => conversation.user_id),
          ...loadedMessages.map((message) => message.user_id)
        ])
      );
      const missingProfileIds = dataUserIds.filter(
        (profileId) => !loadedProfileIds.has(profileId)
      );
      const missingProfilesResult = missingProfileIds.length
        ? await supabase
            .from("profiles")
            .select(profileSelect)
            .in("id", missingProfileIds)
        : { data: [], error: null };

      if (missingProfilesResult.error) {
        throw new Error(missingProfilesResult.error.message);
      }

      const resolvedProfiles = mergeProfiles(
        [currentUserProfile],
        loadedProfiles,
        (missingProfilesResult.data ?? []) as ProfileRow[]
      );

      setCurrentProfile(currentUserProfile);
      setProfiles(resolvedProfiles);
      setConversations(loadedConversations);
      setMessages(loadedMessages);
    }

    loadDashboardData()
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar o dashboard."
        );
      })
      .finally(() => setLoadingData(false));

    const profileChannel = supabase
      .channel(`dashboard-profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles"
        },
        (payload) => {
          const updatedProfile = payload.new as ProfileRow | null;
          const updatedProfileBelongsToUser =
            updatedProfile?.id === userId ||
            Boolean(user.email && updatedProfile?.email === user.email);

          if (!updatedProfile && payload.old && (payload.old as ProfileRow).id === userId) {
            setCurrentProfile(null);
            setProfiles((current) =>
              current.filter((profile) => profile.id !== userId)
            );
            return;
          }

          if (!updatedProfile) {
            return;
          }

          if (updatedProfileBelongsToUser) {
            setCurrentProfile((previousProfile) => {
              const roleChanged =
                Boolean(previousProfile) &&
                profileRole(previousProfile) !== profileRole(updatedProfile);

              if (roleChanged) {
                window.setTimeout(() => setDataVersion((version) => version + 1), 0);
              }

              return updatedProfile;
            });
          }
          setProfiles((current) => {
            const exists = current.some((profile) => profile.id === updatedProfile.id);

            if (!exists) {
              return [updatedProfile, ...current];
            }

            return current.map((profile) =>
              profile.id === updatedProfile.id ? updatedProfile : profile
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [dataVersion, institutionFilter, period, user]);

  const analytics = useMemo(() => {
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const userIds = Array.from(
      new Set([
        ...profiles.map((profile) => profile.id),
        ...conversations.map((conversation) => conversation.user_id),
        ...messages.map((message) => message.user_id)
      ])
    );

    const names = new Map(
      userIds.map((userId) => [
        userId,
        collaboratorName(userId, user, profileById)
      ])
    );

    const ranking: RankingRow[] = userIds
      .map((userId) => {
        const userConversations = conversations.filter(
          (conversation) => conversation.user_id === userId
        );
        const userMessages = messages.filter(
          (message) => message.user_id === userId
        );
        const aiMessages = userMessages.filter(
          (message) => message.role === "assistant"
        ).length;
        const leads = new Set(
          userConversations.map(
            (conversation) => conversation.lead_name?.trim() || conversation.id
          )
        ).size;
        const profile = profileById.get(userId);
        const role = profileRole(profile);

        return {
          id: userId,
          name: names.get(userId) || userId,
          role,
          accesses: profile?.access_count ?? 0,
          lastAccess: profile?.last_access_at ?? null,
          leads,
          conversations: userConversations.length,
          messages: userMessages.length,
          aiMessages,
          aiModel: profile?.ai_model || "gpt-4o-mini",
          score: userConversations.length * 2 + userMessages.length + aiMessages
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

    const accessesByCollaborator = ranking.map((row) => ({
      name: row.name,
      acessos: row.accesses
    }));

    const courses = topItems(
      conversations.map((conversation) => conversation.course),
      "Curso nao informado"
    );

    const objections = topItems(
      conversations.map((conversation) => conversation.objection),
      "Objecao nao informada"
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
      totalAccesses: ranking.reduce((sum, row) => sum + row.accesses, 0),
      latestAccess:
        ranking
          .map((row) => row.lastAccess)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
      totalLeads: ranking.reduce((sum, row) => sum + row.leads, 0),
      ranking,
      activeCollaborator: ranking[0]?.name || "Sem dados",
      averageMessages,
      assistantMessages,
      courses,
      objections,
      leadStatus,
      messagesByCollaborator,
      conversationsByCollaborator,
      accessesByCollaborator,
      leadsByCollaborator: ranking.map((row) => ({
        name: row.name,
        leads: row.leads
      })),
      latestConversations: conversations.slice(0, 6)
    };
  }, [conversations, messages, profiles, user]);

  const currentRole = profileRole(currentProfile);
  const isAdmin = currentRole === "admin";
  const currentRoleLabel = roleLabel(currentRole);
  const activeInstitution: InstitutionFilter = isAdmin
    ? institutionFilter
    : normalizeInstitution(currentProfile?.institution);
  const theme = dashboardTheme(activeInstitution);

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
      <main className={`min-h-screen ${theme.page}`}>
        <section className="flex min-h-screen items-center justify-center px-5">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-soft">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white ${theme.accentText}`}>
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
              className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-bold transition ${theme.primary}`}
            >
              Entrar na Central
            </Link>
          </div>
        </section>
        <SystemFooter />
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${theme.page} text-slate-950`}>
      <section className="mx-auto min-h-screen w-full max-w-7xl bg-slate-50 lg:p-5">
        <div className="grid min-h-screen bg-white lg:min-h-[calc(100vh-40px)] lg:grid-cols-[260px_1fr] lg:rounded-lg lg:shadow-soft">
          <aside className="border-b border-slate-200 bg-[#f0f2f5] p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div className="flex items-start justify-between gap-3 lg:block">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${theme.accentText}`}>
                  Central Comercial IA
                </p>
                <h1 className="mt-2 text-2xl font-bold">Dashboard</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {isAdmin
                    ? "Visao gerencial de conversas, leads e uso da IA."
                    : "Visao individual dos seus atendimentos e uso da IA."}
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
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold text-slate-600 transition hover:bg-white ${theme.accentText}`}
              >
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                Chat Comercial
              </Link>
              <span className={`flex min-h-11 items-center gap-3 rounded-md bg-white px-3 text-sm font-bold ${theme.accentText} shadow-sm`}>
                <BarChart3 aria-hidden="true" className="h-5 w-5" />
                Dashboard
              </span>
            </nav>

            <div className={`mt-6 rounded-lg border p-4 ${theme.soft}`}>
              <p className="text-sm font-bold text-emerald-950">
                Filtro por periodo
              </p>
              <div className="mt-3 grid gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriod(option.key)}
                    className={`min-h-10 rounded-md px-3 text-left text-sm font-bold transition ${
                      period === option.key
                        ? theme.active
                        : `bg-white text-slate-600 ${theme.accentText}`
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div className={`mt-4 rounded-lg border p-4 ${theme.soft}`}>
                <p className="text-sm font-bold text-slate-950">
                  Filtro por instituição
                </p>
                <div className="mt-3 grid gap-2">
                  {[
                    { key: "all" as InstitutionFilter, label: "Todas" },
                    ...institutionOptions
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setInstitutionFilter(option.key)}
                      className={`min-h-10 rounded-md px-3 text-left text-sm font-bold transition ${
                        institutionFilter === option.key
                          ? theme.active
                          : `bg-white text-slate-600 ${theme.accentText}`
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section className="min-w-0 bg-slate-50">
            <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:rounded-tr-lg lg:px-7">
              <div>
                <p className={`flex items-center gap-2 text-sm font-bold ${theme.accentText}`}>
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  {periodOptions.find((option) => option.key === period)?.label}
                  {" · "}
                  {institutionLabel(activeInstitution)}
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {isAdmin
                    ? "Painel gerencial comercial"
                    : currentRole === "consultor"
                      ? "Painel do consultor"
                      : "Dashboard"}
                </h2>
              </div>
              <div className="rounded-md bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                {user.email}
                {` · ${institutionLabel(activeInstitution)}`}
                {currentRoleLabel ? ` · ${currentRoleLabel}` : ""}
              </div>
            </header>

            <div className="grid gap-5 p-5 lg:p-7">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label={isAdmin ? "Total de usuarios" : "Usuario"}
                  value={compactNumber(analytics.totalUsers)}
                />
                <MetricCard
                  icon={<Clock className="h-5 w-5" />}
                  label="Ultimo acesso"
                  value={analytics.latestAccess ? formatDate(analytics.latestAccess) : "sem registro"}
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
                  icon={<Activity className="h-5 w-5" />}
                  label="Total de acessos"
                  value={compactNumber(analytics.totalAccesses)}
                />
                <MetricCard
                  icon={<Flame className="h-5 w-5" />}
                  label="Colaborador mais ativo"
                  value={analytics.activeCollaborator}
                />
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label="Leads atendidos"
                  value={compactNumber(analytics.totalLeads)}
                />
                <MetricCard
                  icon={<Bot className="h-5 w-5" />}
                  label="Total de interacoes IA"
                  value={compactNumber(analytics.assistantMessages)}
                />
                <MetricCard
                  icon={<MessagesSquare className="h-5 w-5" />}
                  label="Media de mensagens por conversa"
                  value={analytics.averageMessages.toFixed(1)}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <Panel
                  title="Ranking de colaboradores por uso"
                  subtitle="Pontuacao considera conversas, mensagens e uso da IA no periodo."
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
                              {row.conversations} conversas · {row.messages} mensagens · {row.aiMessages} IA
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-400">
                              {row.accesses} acessos · ultimo acesso {row.lastAccess ? formatDate(row.lastAccess) : "sem registro"}
                            </p>
                          </div>
                          <strong className="text-lg text-emerald-700">
                            {row.score}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="Sem colaboradores no periodo." />
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
                <Panel title="Acessos por colaborador">
                  <ChartFrame>
                    <BarChart data={analytics.accessesByCollaborator}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar
                        dataKey="acessos"
                        fill={theme.chartC}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ChartFrame>
                </Panel>

                <Panel title="Leads atendidos por usuario">
                  <ChartFrame>
                    <BarChart data={analytics.leadsByCollaborator}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar
                        dataKey="leads"
                        fill={theme.chartB}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ChartFrame>
                </Panel>

                <Panel title="Conversas por colaborador">
                  <ChartFrame>
                    <BarChart data={analytics.conversationsByCollaborator}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar
                        dataKey="conversas"
                        fill={theme.chartA}
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
                        stroke={theme.chartA}
                        strokeWidth={3}
                        dot={{ r: 5, fill: theme.chartA }}
                      />
                    </LineChart>
                  </ChartFrame>
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Usuarios e atividade">
                  <div className="grid gap-3">
                    {analytics.ranking.length ? (
                      analytics.ranking.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-md border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-950">
                                {row.name}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {roleLabel(row.role) ? `${roleLabel(row.role)} · ` : ""}
                                {row.leads} leads atendidos · IA: {row.aiModel}
                              </p>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                              <Clock aria-hidden="true" className="h-3 w-3" />
                              {row.lastAccess ? formatDate(row.lastAccess) : "sem acesso"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="Nenhum usuario encontrado." />
                    )}
                  </div>
                </Panel>

                <Panel title="Ultimas conversas">
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
                                {conversation.course || "Curso nao informado"}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {institutionLabel(conversation.institution)}
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
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Cursos mais consultados">
                  <RankList data={analytics.courses} icon={<Search className="h-4 w-4" />} />
                </Panel>

                <Panel title="Objecoes mais comuns">
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
      <SystemFooter />
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
