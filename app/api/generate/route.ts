import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type InstitutionKey = "unicesumar" | "unifecaf";

type ChatMessage = {
  role: "consultant" | "assistant";
  content: string;
};

const institutionConfig: Record<
  InstitutionKey,
  { label: string; knowledgeFile: string; focus: string[] }
> = {
  unicesumar: {
    label: "UniCesumar",
    knowledgeFile: "unicesumar.md",
    focus: [
      "EAD",
      "modulos",
      "Studeo",
      "polo de apoio",
      "videos dos cursos",
      "aplicativo",
      "suporte pedagogico",
      "provas presenciais",
      "rotina flexivel"
    ]
  },
  unifecaf: {
    label: "UniFECAF",
    knowledgeFile: "unifecaf.md",
    focus: [
      "empregabilidade",
      "mercado de trabalho",
      "EAD e semipresencial",
      "novo polo Santos",
      "conexao com carreira",
      "pos-graduacao",
      "diferenciais profissionais"
    ]
  }
};

function normalizeInstitution(value: unknown): InstitutionKey {
  return value === "unifecaf" ? "unifecaf" : "unicesumar";
}

async function loadKnowledge(institution: InstitutionKey) {
  try {
    return await readFile(
      path.join(
        process.cwd(),
        "knowledge",
        institutionConfig[institution].knowledgeFile
      ),
      "utf8"
    );
  } catch {
    return "";
  }
}

function buildSystemPrompt(institution: InstitutionKey, knowledge: string) {
  const config = institutionConfig[institution];

  return [
    `Voce e um consultor comercial especialista em captacao de alunos da ${config.label}.`,
    "",
    "Seu papel e ajudar o consultor comercial a investigar melhor o lead antes de tentar conduzir para matricula.",
    "Atue como um consultor de vendas consultivo: crie conexao, acolha insegurancas, faca sondagem e so avance quando houver contexto suficiente.",
    "",
    `Instituicao selecionada: ${config.label}.`,
    `Focos comerciais desta instituicao: ${config.focus.join(", ")}.`,
    knowledge ? `Base de conhecimento da instituicao:\n${knowledge}` : "",
    "",
    "Nunca empurre fechamento logo na primeira resposta.",
    "Antes de vender, ajude o consultor a entender o momento, objetivo, rotina e insegurancas do lead.",
    "Sempre faca uma pergunta de sondagem ao final.",
    "Sempre oriente o consultor se vale enviar audio ou video.",
    "Adapte a resposta ao curso informado e explique de forma simples como esse curso pode agregar na carreira do lead.",
    "",
    "Regras de sondagem inteligente:",
    "- quando o lead demonstrar inseguranca com modalidade, sugira video curto, explicacao simples ou audio humanizado",
    "- quando o lead achar caro, explique investimento e valor percebido sem inventar valores",
    "- quando o lead estiver frio, sugira uma pergunta leve para entender o objetivo profissional",
    "- quando o lead tiver pouco tempo, conecte a resposta a rotina e flexibilidade",
    "- quando houver interesse alto, sugira video curto ou convite leve para conhecer o polo, sem pressionar fechamento",
    "",
    "A mensagem para o lead deve:",
    "- ser curta e acolhedora para WhatsApp",
    "- parecer conversa real de WhatsApp",
    "- acolher a duvida ou objecao",
    "- gerar conexao com a realidade do lead",
    "- explicar de forma simples como o curso pode agregar na carreira profissional",
    "- reforcar os diferenciais da instituicao selecionada quando fizer sentido",
    "- terminar com uma pergunta de sondagem para continuar a conversa",
    "",
    "A dica para o consultor deve:",
    "- sugerir uma acao pratica: audio, video, visita ao polo, explicacao de suporte ou pergunta de sondagem",
    "- ser especifica para a instituicao selecionada",
    "- explicar em 1 frase o motivo da acao sugerida",
    "",
    "Formato obrigatorio da resposta:",
    "",
    "Mensagem para o lead:",
    "[texto curto e acolhedor para WhatsApp]",
    "",
    "Dica para o consultor:",
    "[sugestao pratica: audio, video, visita ao polo ou pergunta de sondagem]",
    "",
    "Pergunta de sondagem:",
    "[uma pergunta curta para continuar a conversa]",
    "",
    "Nao prometa emprego, salario ou resultado garantido.",
    "Nao invente valores de mensalidade.",
    "Evite pressao comercial.",
    "Use tom humano, acolhedor e consultivo."
  ]
    .filter(Boolean)
    .join("\n");
}

function isValidMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ChatMessage>;

  return (
    (candidate.role === "consultant" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    Boolean(candidate.content.trim())
  );
}

export async function POST(request: Request) {
  try {
    const { leadName, institution, course, profile, objection, leadStatus, messages } =
      await request.json();
    const selectedInstitution = normalizeInstitution(institution);

    if (!course || !profile || !objection || !Array.isArray(messages)) {
      return NextResponse.json(
        {
          error:
            "Preencha curso, perfil do lead, objecao e envie o historico da conversa."
        },
        { status: 400 }
      );
    }

    const validMessages = messages.filter(isValidMessage);

    if (!validMessages.length) {
      return NextResponse.json(
        { error: "Envie pelo menos uma mensagem do consultor." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Configure a variavel OPENAI_API_KEY no servidor." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    const knowledge = await loadKnowledge(selectedInstitution);

    const chatMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: buildSystemPrompt(selectedInstitution, knowledge)
      },
      {
        role: "user",
        content: [
          `Instituicao: ${institutionConfig[selectedInstitution].label}`,
          leadName ? `Nome do lead: ${leadName}` : "",
          `Curso: ${course}`,
          `Perfil do lead: ${profile}`,
          `Objecao inicial: ${objection}`,
          leadStatus ? `Status do lead: ${leadStatus}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      },
      ...validMessages.map<ChatCompletionMessageParam>((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content:
          message.role === "assistant"
            ? message.content
            : `Mensagem do consultor ou do lead: ${message.content}`
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 320,
      messages: chatMessages
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Nao foi possivel gerar a abordagem agora." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Ocorreu um erro ao gerar a abordagem." },
      { status: 500 }
    );
  }
}
