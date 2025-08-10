import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Download, ImagePlus, Palette, Link2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, BarChart, Bar } from "recharts";
import * as htmlToImage from "html-to-image";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Tipos
type Scores = {
  seguranca: number;
  tecnica: number;
  comunicacao: number;
  aptidaoFisica: number;
  lideranca: number;
  operacional: number;
};

type DayEval = {
  dia: number;
  presente: boolean;
  pontuacoes: ScoresDetail;
  data?: string; // dd/MM
};

type TrainingState = {
  nomeTreinamento: string;
  local: string;
  dias: number;
  totalHoras: number;
  startDate?: string; // ISO yyyy-MM-dd
  endDate?: string;   // ISO yyyy-MM-dd
  candidato: {
    nome: string;
    idade?: number;
    fotoBase64?: string;
  };
  logoBase64?: string;
  avaliacoes: DayEval[];
  tema?: {
    background?: string; // HSL string "h s% l%"
    foreground?: string;
    primary?: string;
  };
};

const STORAGE_KEY = "adventure-training-eval-v1";
const TRAINING_KEY = "adventure-training-settings-v1";
const PARTICIPANTS_KEY = "adventure-training-participants-v1";
const CURRENT_PARTICIPANT_KEY = "adventure-training-current-v1";
const EVAL_KEY_PREFIX = "adventure-training-eval-v1:p:";

type Participant = {
  id: string;
  nome: string;
  idade?: number;
  fotoBase64?: string;
};

const CATEGORIAS: Array<keyof Scores> = [
  "seguranca",
  "tecnica",
  "comunicacao",
  "aptidaoFisica",
  "lideranca",
  "operacional",
];

const CATEGORIA_LABEL: Record<keyof Scores, string> = {
  seguranca: "Segurança",
  tecnica: "Técnica",
  comunicacao: "Comunicação",
  aptidaoFisica: "Aptidão Física",
  lideranca: "Liderança",
  operacional: "Operacional",
};

// Subtópicos por competência (3 por tópico)
// As médias dos tópicos serão calculadas a partir desses subtópicos (0-10)
type ScoresDetail = Record<keyof Scores, [number, number, number]>;

const SUBTOPICOS: Record<keyof Scores, [string, string, string]> = {
  seguranca: ["Prevenção", "EPI", "Procedimentos"],
  tecnica: ["Conhecimento", "Execução", "Eficiência"],
  comunicacao: ["Clareza", "Assertividade", "Consistência"],
  aptidaoFisica: ["Resistência", "Força", "Agilidade"],
  lideranca: ["Motivação", "Gestão de Conflitos", "Tomada de Decisão"],
  operacional: ["Planejamento", "Cacipe", "Operação"],
};

const getCategoryAverage = (p: ScoresDetail, cat: keyof Scores) => average(p[cat]);

function hexToHslString(hex: string): string | undefined {
  // Remove '#'
  const c = hex.replace('#','');
  if (![3,6].includes(c.length)) return undefined;
  const bigint = parseInt(c.length===3 ? c.split('').map(ch=>ch+ch).join('') : c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const r1 = r/255, g1 = g/255, b1 = b/255;
  const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r1: h = (g1-b1)/d + (g1 < b1 ? 6 : 0); break;
      case g1: h = (b1-r1)/d + 2; break;
      case b1: h = (r1-g1)/d + 4; break;
    }
    h /= 6;
  }
  const H = Math.round(h*360);
  const S = Math.round(s*100);
  const L = Math.round(l*100);
  return `${H} ${S}% ${L}%`;
}

function setCssVar(name: string, value: string | undefined) {
  if (!value) return;
  document.documentElement.style.setProperty(name, value);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2));
}

function toISODate(d: Date): string { return format(d, 'yyyy-MM-dd'); }
function parseISODateLocal(s: string): Date { const [y, m, day] = s.split('-').map(Number); return new Date((y || 1970), (m || 1) - 1, (day || 1)); }
function adjustAvaliacaoLength(existing: DayEval[] | undefined, dias: number, startDate?: string): DayEval[] {
  const base = existing && Array.isArray(existing) ? existing.slice(0, dias) : [] as DayEval[];
  const result: DayEval[] = [];
  for (let i = 0; i < dias; i++) {
    const prev = base[i];
    const date = startDate ? format(addDays(parseISODateLocal(startDate), i), "dd/MM") : undefined;
    if (prev) {
      result.push({ ...prev, dia: i + 1, data: date });
    } else {
      result.push({
        dia: i + 1,
        presente: true,
        pontuacoes: {
          seguranca: [0, 0, 0],
          tecnica: [0, 0, 0],
          comunicacao: [0, 0, 0],
          aptidaoFisica: [0, 0, 0],
          lideranca: [0, 0, 0],
          operacional: [0, 0, 0],
        },
        data: date,
      });
    }
  }
  return result;
}

const Index = () => {
const [state, setState] = useState<TrainingState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as any;
        const sample = parsed?.avaliacoes?.[0]?.pontuacoes?.seguranca;
        if (typeof sample === 'number') {
          parsed.avaliacoes = parsed.avaliacoes.map((d: any) => ({
            ...d,
            pontuacoes: {
              seguranca: [d.pontuacoes.seguranca, d.pontuacoes.seguranca, d.pontuacoes.seguranca],
              tecnica: [d.pontuacoes.tecnica, d.pontuacoes.tecnica, d.pontuacoes.tecnica],
              comunicacao: [d.pontuacoes.comunicacao, d.pontuacoes.comunicacao, d.pontuacoes.comunicacao],
              aptidaoFisica: [d.pontuacoes.aptidaoFisica, d.pontuacoes.aptidaoFisica, d.pontuacoes.aptidaoFisica],
              lideranca: [d.pontuacoes.lideranca, d.pontuacoes.lideranca, d.pontuacoes.lideranca],
              operacional: [d.pontuacoes.operacional, d.pontuacoes.operacional, d.pontuacoes.operacional],
            }
          }));
        }
        return parsed as TrainingState;
      } catch { /* ignore and fall back to default */ }
    }
    return {
      nomeTreinamento: "",
      local: "",
      dias: 3,
      totalHoras: 3*8,
      candidato: { nome: "" },
      avaliacoes: Array.from({length:3}, (_,i)=>({
        dia: i+1,
        presente: true,
        pontuacoes: {
          seguranca: [0,0,0],
          tecnica: [0,0,0],
          comunicacao: [0,0,0],
          aptidaoFisica: [0,0,0],
          lideranca: [0,0,0],
          operacional: [0,0,0],
        }
      }))
    };
  });

  const reportRef = useRef<HTMLDivElement>(null);
const skipSaveRef = useRef(false);
const [activeTab, setActiveTab] = useState("cadastro");
const [participants, setParticipants] = useState<Participant[]>([]);
const [currentParticipantId, setCurrentParticipantId] = useState<string | undefined>(undefined);
const [newPartName, setNewPartName] = useState<string>("");
const [newPartAge, setNewPartAge] = useState<string>("");

  useEffect(()=>{
    // Carregar configurações e participantes ao montar
    try {
      const tStr = localStorage.getItem(TRAINING_KEY);
      if (tStr) {
        const t = JSON.parse(tStr);
        skipSaveRef.current = true;
        setState(prev => ({
          ...prev,
          nomeTreinamento: t.nomeTreinamento ?? prev.nomeTreinamento,
          local: t.local ?? prev.local,
          dias: t.dias ?? prev.dias,
          totalHoras: t.totalHoras ?? prev.totalHoras,
          startDate: t.startDate ?? prev.startDate,
          endDate: t.endDate ?? prev.endDate,
          tema: t.tema ?? prev.tema,
          logoBase64: t.logoBase64 ?? prev.logoBase64,
        }));
      }
    } catch {}
    try {
      const pStr = localStorage.getItem(PARTICIPANTS_KEY);
      if (pStr) setParticipants(JSON.parse(pStr) as Participant[]);
    } catch {}
    const cur = localStorage.getItem(CURRENT_PARTICIPANT_KEY) || undefined;
    setCurrentParticipantId(cur || undefined);
  },[]);

  useEffect(()=>{
    // Ao trocar participante ou mudar dias/início, carregar/ajustar avaliações
    if (!currentParticipantId) return;
    const p = participants.find(x=>x.id===currentParticipantId);
    if (!p) return;
    let avaliacoes: DayEval[] | undefined;
    const raw = localStorage.getItem(EVAL_KEY_PREFIX + currentParticipantId);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { avaliacoes?: DayEval[] };
        avaliacoes = saved.avaliacoes;
      } catch {}
    }
    const adjusted = adjustAvaliacaoLength(avaliacoes, state.dias, state.startDate);
    skipSaveRef.current = true;
    setState(prev => ({ ...prev, candidato: { nome: p.nome, idade: p.idade, fotoBase64: p.fotoBase64 }, avaliacoes: adjusted }));
  },[currentParticipantId, participants, state.dias, state.startDate]);

  useEffect(()=>{
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    // Salvar apenas configurações do treinamento
    const { nomeTreinamento, local, dias, totalHoras, startDate, endDate, tema, logoBase64 } = state;
    const training = { nomeTreinamento, local, dias, totalHoras, startDate, endDate, tema, logoBase64 };
    localStorage.setItem(TRAINING_KEY, JSON.stringify(training));
  },[state.nomeTreinamento, state.local, state.dias, state.totalHoras, state.startDate, state.endDate, state.tema, state.logoBase64]);

  useEffect(()=>{
    // Persistir lista de participantes
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
  },[participants]);

  useEffect(()=>{
    // Persistir participante atual
    if (currentParticipantId) localStorage.setItem(CURRENT_PARTICIPANT_KEY, currentParticipantId);
  },[currentParticipantId]);

  useEffect(()=>{
    // Salvar avaliações do participante atual
    if (!currentParticipantId) return;
    const payload = { avaliacoes: state.avaliacoes };
    localStorage.setItem(EVAL_KEY_PREFIX + currentParticipantId, JSON.stringify(payload));
  },[state.avaliacoes, currentParticipantId]);

  // Aplicar tema salvo
  useEffect(()=>{
    if (state.tema) {
      setCssVar('--background', state.tema.background);
      setCssVar('--foreground', state.tema.foreground);
      setCssVar('--primary', state.tema.primary);
    }
  },[]);

  // Atualiza dias e total de horas
  const updateDias = (dias: number) => {
    setState(prev => {
      const current = [...prev.avaliacoes];
      if (dias > current.length) {
        for (let i = current.length; i < dias; i++) {
          current.push({
            dia: i + 1,
            presente: true,
            pontuacoes: {
              seguranca: [0, 0, 0],
              tecnica: [0, 0, 0],
              comunicacao: [0, 0, 0],
              aptidaoFisica: [0, 0, 0],
              lideranca: [0, 0, 0],
              operacional: [0, 0, 0],
            },
          });
        }
      } else if (dias < current.length) {
        current.length = dias;
      }
      const updated = current.map((d, i) => ({ ...d, dia: i + 1 }));

      let endDate = prev.endDate;
      if (prev.startDate) {
        for (let i = 0; i < updated.length; i++) {
          const date = addDays(parseISODateLocal(prev.startDate), i);
          updated[i] = { ...updated[i], data: format(date, "dd/MM") };
        }
        endDate = toISODate(addDays(parseISODateLocal(prev.startDate), dias - 1));
      } else {
        for (let i = 0; i < updated.length; i++) {
          updated[i] = { ...updated[i], data: undefined };
        }
      }

      return {
        ...prev,
        dias,
        totalHoras: dias * 8,
        avaliacoes: updated,
        endDate,
      };
    });
  };

  const presentCount = useMemo(()=> state.avaliacoes.filter(d=>d.presente).length, [state.avaliacoes]);
  const freqPercent = useMemo(()=> state.dias ? Math.round((presentCount/state.dias)*100) : 0, [presentCount, state.dias]);

const perDayAvg = useMemo(()=> state.avaliacoes.map(d=>{
    const catMedias = CATEGORIAS.map((k)=> average(d.pontuacoes[k]));
    return {
      day: d.data ?? `Dia ${d.dia}`,
      media: average(catMedias),
    };
  }), [state.avaliacoes]);

  const evaluatedDays = useMemo(()=> state.avaliacoes.filter(d=>d.presente), [state.avaliacoes]);
const overallAverage = useMemo(()=> average(evaluatedDays.map(d=> average(CATEGORIAS.map(k=> average(d.pontuacoes[k]))))), [evaluatedDays]);

  const categoryOverall = useMemo(()=>{
    const result: Record<keyof Scores, number> = {
      seguranca: 0, tecnica: 0, comunicacao: 0, aptidaoFisica: 0, lideranca: 0, operacional: 0
    };
    if (!evaluatedDays.length) return result;
    for (const key of CATEGORIAS) {
      result[key] = average(evaluatedDays.map(d=> average(d.pontuacoes[key])));
    }
    return result;
  },[evaluatedDays]);

  const sortedCats = useMemo(() =>
    CATEGORIAS
      .map((k) => ({ key: k as keyof Scores, label: CATEGORIA_LABEL[k], nota: categoryOverall[k] }))
      .sort((a, b) => b.nota - a.nota)
  , [categoryOverall]);

  const strengths = useMemo(() => sortedCats.slice(0, 2).filter((c) => c.nota > 0), [sortedCats]);
  const weaknesses = useMemo(() => sortedCats.slice(-2), [sortedCats]);

const subtopicChartData = useMemo(()=> {
    return CATEGORIAS.map((k)=>{
      const arr: [number, number, number] = [0,0,0];
      if (evaluatedDays.length) {
        arr[0] = average(evaluatedDays.map(d => d.pontuacoes[k][0]));
        arr[1] = average(evaluatedDays.map(d => d.pontuacoes[k][1]));
        arr[2] = average(evaluatedDays.map(d => d.pontuacoes[k][2]));
      }
      return { categoria: CATEGORIA_LABEL[k], s1: arr[0], s2: arr[1], s3: arr[2] };
    });
  }, [evaluatedDays]);

  const status = useMemo(()=>{
    if (state.dias > 0 && freqPercent < 70) return { label: "Reprovado por frequência", color: "destructive" as const };
    if (overallAverage >= 8) return { label: "Aprovado", color: "primary" as const };
    if (overallAverage >= 7 && overallAverage < 8) return { label: "Aprovado com nota mínima (requer melhoria)", color: "secondary" as const };
    if (overallAverage < 7) return { label: "Reprovado", color: "destructive" as const };
    return { label: "Em análise", color: "muted" as const };
  },[overallAverage, freqPercent, state.dias]);

  const onExport = async () => {
    if (!reportRef.current) return;
    try {
      const root = getComputedStyle(document.documentElement);
      const bg = `hsl(${root.getPropertyValue('--background').trim()})`;
      const styleVars: Record<string, string> = {
        '--background': root.getPropertyValue('--background').trim(),
        '--foreground': root.getPropertyValue('--foreground').trim(),
        '--primary': root.getPropertyValue('--primary').trim(),
        '--card': root.getPropertyValue('--card').trim(),
        '--card-foreground': root.getPropertyValue('--card-foreground').trim(),
        '--muted': root.getPropertyValue('--muted').trim(),
        '--muted-foreground': root.getPropertyValue('--muted-foreground').trim(),
        '--accent': root.getPropertyValue('--accent').trim(),
        '--destructive': root.getPropertyValue('--destructive').trim(),
        '--border': root.getPropertyValue('--border').trim(),
      };
      const dataUrl = await htmlToImage.toPng(reportRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: bg, style: styleVars, skipFonts: true });
      const a = document.createElement('a');
      const safeNome = (state.candidato.nome || 'candidato').replace(/\s+/g,'_');
      a.download = `relatorio_${safeNome}.png`;
      a.href = dataUrl;
      a.click();
      toast({ title: "Relatório exportado", description: "O PNG foi gerado com as cores." });
    } catch (e) {
      toast({ title: "Falha ao exportar", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const onGenerateLink = async () => {
    try {
      const share = {
        nomeTreinamento: state.nomeTreinamento,
        local: state.local,
        dias: state.dias,
        totalHoras: state.totalHoras,
        startDate: state.startDate,
        endDate: state.endDate,
        candidato: state.candidato,
        logoBase64: state.logoBase64,
        avaliacoes: state.avaliacoes,
        tema: state.tema,
      };
      const json = JSON.stringify(share);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
      const url = `${window.location.origin}/relatorio?d=${base64url}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Relatório do treinamento', text: 'Acesse seu relatório', url }); } catch {}
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link gerado', description: 'URL copiada para a área de transferência.' });
    } catch (e) {
      toast({ title: 'Falha ao gerar link', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const onUploadImage = (file: File, target: 'foto' | 'logo') => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (target === 'foto') {
        if (currentParticipantId) {
          setParticipants(prev => prev.map(p => p.id === currentParticipantId ? { ...p, fotoBase64: base64 } : p));
        }
        setState(prev=> ({
          ...prev,
          candidato: { ...prev.candidato, fotoBase64: base64 },
        }));
      } else {
        setState(prev=> ({
          ...prev,
          logoBase64: base64,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    skipSaveRef.current = true;
    localStorage.removeItem(STORAGE_KEY);
    setState({
      nomeTreinamento: "",
      local: "",
      dias: 3,
      totalHoras: 3*8,
      candidato: { nome: "" },
      avaliacoes: Array.from({length:3}, (_,i)=>({
        dia: i+1,
        presente: true,
        pontuacoes: {
          seguranca: [0,0,0],
          tecnica: [0,0,0],
          comunicacao: [0,0,0],
          aptidaoFisica: [0,0,0],
          lideranca: [0,0,0],
          operacional: [0,0,0],
        }
      }))
    });
    toast({ title: "Formulário resetado", description: "Dados limpos do navegador." });
  };

  const ThemePicker = () => {
    const [bgHex, setBgHex] = useState<string>("");
    const [fgHex, setFgHex] = useState<string>("");
    const [priHex, setPriHex] = useState<string>("");

    const apply = () => {
      const background = hexToHslString(bgHex);
      const foreground = hexToHslString(fgHex);
      const primary = hexToHslString(priHex);
      setCssVar('--background', background);
      setCssVar('--foreground', foreground);
      setCssVar('--primary', primary);
      setState(prev=> ({...prev, tema: { background, foreground, primary }}));
      toast({ title: "Tema aplicado", description: "Cores atualizadas." });
    };

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="bg">Cor de fundo</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input id="bg" type="color" aria-label="Cor de fundo" value={bgHex} onChange={e=>setBgHex(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="fg">Cor da fonte</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input id="fg" type="color" aria-label="Cor da fonte" value={fgHex} onChange={e=>setFgHex(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="pri">Cor primária (botões)</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input id="pri" type="color" aria-label="Cor primária" value={priHex} onChange={e=>setPriHex(e.target.value)} />
          </div>
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={apply} className="transition-[transform] duration-200 hover:scale-[1.02]">
            <Palette className="mr-2 h-4 w-4" /> Aplicar tema
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[hsl(var(--accent))] to-[hsl(var(--background))]">
      <header className="container py-8">
        <div className="flex items-center gap-4">
          {state.logoBase64 ? (
            <img src={state.logoBase64} alt="Logo da empresa" loading="lazy" className="h-12 w-12 rounded-md object-cover shadow" />
          ) : null}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Avaliador de Treinamento de Aventura</h1>
        </div>
      </header>

      <main className="container pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro">
            <section className="grid gap-6 md:grid-cols-2 mt-6">
              <Card className="shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle>Informações do Treinamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="nomeTreino">Nome do treinamento</Label>
                    <Input id="nomeTreino" value={state.nomeTreinamento} onChange={e=>setState(prev=>({...prev, nomeTreinamento: e.target.value}))} placeholder="Ex.: Curso de Turismo de Aventura" />
                  </div>
                  <div>
                    <Label htmlFor="local">Local</Label>
                    <Input id="local" value={state.local} onChange={e=>setState(prev=>({...prev, local: e.target.value}))} placeholder="Ex.: Serra do Cipó" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dias">Quantidade de dias</Label>
                      <Input id="dias" type="number" min={1} value={state.dias} onChange={e=>updateDias(Math.max(1, Number(e.target.value)))} />
                    </div>
                    <div>
                      <Label>Total de horas</Label>
                      <Input readOnly value={`${state.totalHoras} h`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start font-normal", !state.startDate && "text-muted-foreground")}
                          >
                            {state.startDate ? format(parseISODateLocal(state.startDate), "dd/MM") : <span>Selecione</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={state.startDate ? parseISODateLocal(state.startDate) : undefined}
                            onSelect={(d) => {
                              setState(prev => {
                                const start = d ? toISODate(d) : undefined;
                                let aval = prev.avaliacoes.map((day, i) => {
                                  if (!start) return { ...day, data: undefined };
                                  const date = addDays(parseISODateLocal(start), i);
                                  return { ...day, data: format(date, "dd/MM") };
                                });
                                const end = start ? toISODate(addDays(parseISODateLocal(start), (prev.dias ?? aval.length) - 1)) : prev.endDate;
                                return { ...prev, startDate: start, endDate: end, avaliacoes: aval };
                              });
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start font-normal", !state.endDate && "text-muted-foreground")}
                          >
                            {state.endDate ? format(parseISODateLocal(state.endDate), "dd/MM") : <span>Selecione</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={state.endDate ? parseISODateLocal(state.endDate) : undefined}
                            onSelect={(d) => {
                              setState(prev => ({ ...prev, endDate: d ? toISODate(d) : undefined }));
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle>Participantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="novoParticipante">Nome</Label>
                      <Input id="novoParticipante" placeholder="Nome do participante" value={newPartName} onChange={e=>setNewPartName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="idadeParticipante">Idade</Label>
                      <Input id="idadeParticipante" type="number" min={10} placeholder="Opcional" value={newPartAge} onChange={e=>setNewPartAge(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onClick={() => {
                      const nome = newPartName.trim();
                      if (!nome) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
                      const id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : String(Date.now());
                      const idade = newPartAge ? Number(newPartAge) : undefined;
                      const novo: Participant = { id, nome, idade };
                      setParticipants(prev => [...prev, novo]);
                      setCurrentParticipantId(id);
                      setNewPartName("");
                      setNewPartAge("");
                    }}>Adicionar participante</Button>
                  </div>
                  <div className="space-y-2">
                    {participants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum participante cadastrado.</p>
                    ) : (
                      <ul className="space-y-2">
                        {participants.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <div className="text-sm">
                              <div className="font-medium">{p.nome}</div>
                              {p.idade ? <div className="text-muted-foreground">Idade: {p.idade}</div> : null}
                            </div>
                            <Button type="button" variant={currentParticipantId === p.id ? "secondary" : "outline"} onClick={() => setCurrentParticipantId(p.id)}>
                              {currentParticipantId === p.id ? "Selecionado" : "Selecionar"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle>Dados do Candidato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="nomeCand">Nome do candidato</Label>
                    <Input id="nomeCand" value={state.candidato.nome} onChange={e=>{
                      const v = e.target.value;
                      setState(prev=>({...prev, candidato: {...prev.candidato, nome: v}}));
                      if (currentParticipantId) setParticipants(prev=>prev.map(p=>p.id===currentParticipantId?{...p, nome: v}:p));
                    }} placeholder="Nome completo" />
                  </div>
                  <div>
                    <Label htmlFor="idade">Idade</Label>
                    <Input id="idade" type="number" min={10} value={state.candidato.idade ?? ''} onChange={e=>{
                      const num = Number(e.target.value);
                      setState(prev=>({...prev, candidato: {...prev.candidato, idade: num}}));
                      if (currentParticipantId) setParticipants(prev=>prev.map(p=>p.id===currentParticipantId?{...p, idade: num}:p));
                    }} placeholder="Opcional" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={()=>document.getElementById('fotoCand')?.click()}>
                      <ImagePlus className="mr-2 h-4 w-4"/> Foto do candidato (opcional)
                    </Button>
                    <input id="fotoCand" type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) onUploadImage(f,'foto'); }} />
                    {state.candidato.fotoBase64 && (
                      <img src={state.candidato.fotoBase64} alt="Foto do candidato" loading="lazy" className="h-12 w-12 rounded-md object-cover" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5"/> Personalizar Cores & Logo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ThemePicker />
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" onClick={()=>document.getElementById('logoEmp')?.click()}>
                      <ImagePlus className="mr-2 h-4 w-4"/> Logo da empresa (opcional)
                    </Button>
                    <input id="logoEmp" type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) onUploadImage(f,'logo'); }} />
                    {state.logoBase64 && (
                      <img src={state.logoBase64} alt="Logo da empresa" loading="lazy" className="h-10 w-10 rounded-md object-cover" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
            <div className="mt-4 flex justify-end">
              <Button variant="destructive" onClick={handleReset} aria-label="Resetar formulário e limpar dados">
                Resetar formulário e limpar dados
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="avaliacao">
            <section className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.avaliacoes.map((diaItem, idx)=> (
                <Card key={diaItem.dia} className="transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{`Dia ${diaItem.dia}${diaItem.data ? ` - ${diaItem.data}` : ""}`}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`presenca-${idx}`} checked={diaItem.presente} onCheckedChange={(c)=>{
                        const checked = Boolean(c);
                        setState(prev=> ({
                          ...prev,
                          avaliacoes: prev.avaliacoes.map((d,i)=> i===idx ? { ...d, presente: checked } : d)
                        }));
                      }} />
                      <Label htmlFor={`presenca-${idx}`}>Presença</Label>
                    </div>

{CATEGORIAS.map((cat)=> {
                        const subs = SUBTOPICOS[cat];
                        const values = diaItem.pontuacoes[cat];
                        const mediaCat = average(values).toFixed(1);
                        return (
                          <div key={cat} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{CATEGORIA_LABEL[cat]}</span>
                              <span className="font-medium">{mediaCat}</span>
                            </div>
                            <div className="space-y-3">
                              {subs.map((label, sIdx)=> (
                                <div key={sIdx}>
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{label}</span>
                                    <span className="font-medium">{values[sIdx]}</span>
                                  </div>
                                  <Slider min={0} max={10} step={1} value={[values[sIdx]]} onValueChange={(v)=>{
                                    const val = v[0] ?? 0;
                                    setState(prev=> ({
                                      ...prev,
                                      avaliacoes: prev.avaliacoes.map((d,i)=> {
                                        if (i!==idx) return d;
                                        const arr = [...d.pontuacoes[cat]] as [number, number, number];
                                        arr[sIdx] = val;
                                        return { ...d, pontuacoes: { ...d.pontuacoes, [cat]: arr } };
                                      })
                                    }));
                                  }} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="relatorio">
            <section className="mt-6 space-y-6" ref={reportRef}>
              <Card className="shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle>Resumo</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Treinamento</div>
                    <div className="font-semibold">{state.nomeTreinamento || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Local</div>
                    <div className="font-semibold">{state.local || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Período</div>
                    <div className="font-semibold">
                      {state.avaliacoes[0]?.data && state.avaliacoes[state.avaliacoes.length-1]?.data
                        ? `${state.avaliacoes[0]?.data} – ${state.avaliacoes[state.avaliacoes.length-1]?.data}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Candidato</div>
                    <div className="font-semibold">{state.candidato.nome || '—'}{state.candidato.idade ? `, ${state.candidato.idade} anos` : ''}</div>
                  </div>
                  {state.candidato.fotoBase64 && (
                    <div className="flex items-start gap-3 md:col-start-3 md:row-start-1 md:row-span-2 justify-self-end">
                      <img
                        src={state.candidato.fotoBase64}
                        alt={`Foto do candidato ${state.candidato.nome || ''}`}
                        loading="lazy"
                        className="h-20 w-20 rounded-full object-cover ring-1 ring-border shadow"
                      />
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-muted-foreground">Dias</div>
                    <div className="font-semibold">{state.dias}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Horas</div>
                    <div className="font-semibold">{state.totalHoras} h</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Frequência</div>
                    <div className="font-semibold">{freqPercent}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Média final</div>
                    <div className="font-semibold">{overallAverage}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className={`font-semibold`}>{status.label}</div>
                  </div>
                </CardContent>
               </Card>

               <Card className="shadow-[var(--shadow-soft)]">
                 <CardHeader>
                   <CardTitle>Feedback</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   {status.label === "Aprovado" && (
                     <div className="space-y-2">
                       <p>Parabéns! O candidato foi aprovado. Pontos fortes:</p>
                       <ul className="list-disc pl-5 text-sm">
                         {strengths.map((s) => (
                           <li key={s.label}>{s.label}: {s.nota.toFixed(1)}</li>
                         ))}
                       </ul>
                       <p className="text-sm text-muted-foreground">Mantenha a consistência e continue avançando nesses aspectos.</p>
                     </div>
                   )}

                   {status.label.startsWith("Aprovado com") && (
                     <div className="space-y-2">
                       <p>Aprovado com nota mínima. Atenção aos pontos fracos:</p>
                       <ul className="list-disc pl-5 text-sm">
                         {weaknesses.map((s) => (
                           <li key={s.label}>{s.label}: {s.nota.toFixed(1)}</li>
                         ))}
                       </ul>
                       <p className="text-sm text-muted-foreground">Recomenda-se plano de melhoria focado e revisão de procedimentos.</p>
                     </div>
                   )}

                   {(status.label === "Reprovado") && (
                     <div className="space-y-2">
                       <p>Reprovado por desempenho. Principais pontos a melhorar:</p>
                       <ul className="list-disc pl-5 text-sm">
                         {weaknesses.map((s) => (
                           <li key={s.label}>{s.label}: {s.nota.toFixed(1)}</li>
                         ))}
                       </ul>
                       <p className="text-sm text-muted-foreground">Sugere-se refazer o treinamento após um plano de desenvolvimento direcionado.</p>
                     </div>
                   )}

                   {status.label === "Reprovado por frequência" && (
                     <div className="space-y-2">
                       <p>Reprovado por frequência ({freqPercent}%). A frequência mínima exigida é 70%.</p>
                       <p className="text-sm text-muted-foreground">Agende nova participação garantindo presença suficiente para avaliação completa.</p>
                     </div>
                   )}
                 </CardContent>
               </Card>

               <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Médias por dia</CardTitle>
                  </CardHeader>
                  <CardContent style={{height: 320}}>
                    <ResponsiveContainer key={activeTab} width="100%" height="100%">
                      <BarChart data={perDayAvg}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis domain={[0,10]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="media" name="Média" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Média por competência</CardTitle>
                  </CardHeader>
                  <CardContent style={{height: 320}}>
                    <ResponsiveContainer key={activeTab} width="100%" height="100%">
                      <RadarChart data={CATEGORIAS.map((k)=>({
                        categoria: CATEGORIA_LABEL[k],
                        nota: categoryOverall[k]
                      }))}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="categoria" />
                        <PolarRadiusAxis domain={[0,10]} />
                        <Radar name="Média" dataKey="nota" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
               </div>
               <Card>
                 <CardHeader>
                   <CardTitle>Evolução diária (linha)</CardTitle>
                 </CardHeader>
                 <CardContent style={{height: 320}}>
                   <ResponsiveContainer key={activeTab} width="100%" height="100%">
                     <LineChart data={perDayAvg}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="day" />
                       <YAxis domain={[0,10]} />
                       <Tooltip />
                       <Legend />
                       <Line type="monotone" dataKey="media" name="Média" stroke="hsl(var(--primary))" dot />
                     </LineChart>
                   </ResponsiveContainer>
                 </CardContent>
               </Card>
               <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Subtópicos por competência (média)</CardTitle>
                </CardHeader>
                <CardContent style={{height: 360}}>
                  <ResponsiveContainer key={activeTab} width="100%" height="100%">
                    <BarChart data={subtopicChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="categoria" />
                      <YAxis domain={[0,10]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="s1" name="Subtópico 1" fill="hsl(var(--primary))" />
                      <Bar dataKey="s2" name="Subtópico 2" fill="hsl(var(--primary))" fillOpacity={0.8} />
                      <Bar dataKey="s3" name="Subtópico 3" fill="hsl(var(--primary))" fillOpacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={onGenerateLink}>
                <Link2 className="mr-2 h-4 w-4"/> Gerar link do relatório
              </Button>
              <Button onClick={onExport}>
                <Download className="mr-2 h-4 w-4"/> Exportar relatório (PNG)
              </Button>
            </div>

            {/* Structured Data */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'Avaliador de Treinamento de Aventura',
                applicationCategory: 'BusinessApplication',
                description: 'Ferramenta para avaliar candidatos em treinamentos de turismo de aventura com relatórios e gráficos.'
              }) }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
