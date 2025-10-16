import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, BarChart, Bar } from 'recharts';

// Tipos
type Scores = {
  seguranca: number;
  tecnica: number;
  comunicacao: number;
  aptidaoFisica: number;
  lideranca: number;
  operacional: number;
};

// Subtópicos por competência
type ScoresDetail = Record<keyof Scores, [number, number, number]>;

const CATEGORIAS: Array<keyof Scores> = [
  'seguranca',
  'tecnica',
  'comunicacao',
  'aptidaoFisica',
  'lideranca',
  'operacional',
];

const CATEGORIA_LABEL: Record<keyof Scores, string> = {
  seguranca: 'Segurança',
  tecnica: 'Técnica',
  comunicacao: 'Comunicação',
  aptidaoFisica: 'Aptidão Física',
  lideranca: 'Liderança',
  operacional: 'Operacional',
};

const SUBTOPICOS: Record<keyof Scores, [string, string, string]> = {
  seguranca: ['Prevenção', 'EPI', 'Procedimentos'],
  tecnica: ['Conhecimento', 'Execução', 'Eficiência'],
  comunicacao: ['Clareza', 'Assertividade', 'Consistência'],
  aptidaoFisica: ['Resistência', 'Força', 'Agilidade'],
  lideranca: ['Motivação', 'Gestão de Conflitos', 'Tomada de Decisão'],
  operacional: ['Planejamento', 'Cacipe', 'Operação'],
};

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function setCssVar(name: string, value?: string) {
  if (!value) return;
  document.documentElement.style.setProperty(name, value);
}

function decodePayload(packed: string) {
  const pad = (s: string) => s + '='.repeat((4 - (s.length % 4)) % 4);
  const base64 = pad(packed.replace(/-/g, '+').replace(/_/g, '/'));
  const json = decodeURIComponent(escape(atob(base64)));
  return JSON.parse(json);
}

type DayEval = { dia: number; presente: boolean; pontuacoes: ScoresDetail; data?: string };

type TrainingState = {
  nomeTreinamento: string;
  local: string;
  dias: number;
  totalHoras: number;
  candidato: { nome: string; idade?: number; fotoBase64?: string };
  logoBase64?: string;
  avaliacoes: DayEval[];
  tema?: { background?: string; foreground?: string; primary?: string };
};

const ShareReport = () => {
  const [params] = useSearchParams();
  const d = params.get('d');
  const reportRef = useRef<HTMLDivElement>(null);

  let state: TrainingState | null = null;
  try {
    if (d) state = decodePayload(d) as TrainingState;
  } catch {
    state = null;
  }

  useEffect(() => {
    document.title = state?.candidato?.nome
      ? `Relatório - ${state.candidato.nome}`
      : 'Relatório do Treinamento';
    // Meta description
    const metaDesc =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m;
      })();
    metaDesc.setAttribute(
      'content',
      'Relatório individual do treinamento com resultados, gráficos e feedback.'
    );
    // Canonical
    const link =
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l;
      })();
    link.setAttribute('href', window.location.href);
  }, [state]);

  // Aplicar tema do relatório compartilhado
  useEffect(() => {
    if (state?.tema) {
      setCssVar('--background', state.tema.background);
      setCssVar('--foreground', state.tema.foreground);
      setCssVar('--primary', state.tema.primary);
    }
  }, [state]);

  const colors = useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      primary: `hsl(${root.getPropertyValue('--primary').trim()})`,
      background: `hsl(${root.getPropertyValue('--background').trim()})`,
    };
  }, [state?.tema]);

  const presentCount = useMemo(
    () => state?.avaliacoes.filter((d) => d.presente).length ?? 0,
    [state]
  );
  const freqPercent = useMemo(
    () => (state?.dias ? Math.round((presentCount / state.dias) * 100) : 0),
    [presentCount, state?.dias]
  );

  const evaluatedDays = useMemo(
    () => state?.avaliacoes.filter((d) => d.presente) ?? [],
    [state]
  );

  const overallAverage = useMemo(
    () =>
      average(
        evaluatedDays.map((d) =>
          average(CATEGORIAS.map((k) => average(d.pontuacoes[k])))
        )
      ),
    [evaluatedDays]
  );

  const categoryOverall = useMemo(() => {
    const result: Record<keyof Scores, number> = {
      seguranca: 0,
      tecnica: 0,
      comunicacao: 0,
      aptidaoFisica: 0,
      lideranca: 0,
      operacional: 0,
    };
    if (!evaluatedDays.length) return result;
    for (const key of CATEGORIAS) {
      result[key] = average(evaluatedDays.map((d) => average(d.pontuacoes[key])));
    }
    return result;
  }, [evaluatedDays]);

  const sortedCats = useMemo(
    () =>
      CATEGORIAS.map((k) => ({
        key: k as keyof Scores,
        label: CATEGORIA_LABEL[k],
        nota: categoryOverall[k],
      })).sort((a, b) => b.nota - a.nota),
    [categoryOverall]
  );

  const strengths = useMemo(
    () => sortedCats.slice(0, 2).filter((c) => c.nota > 0),
    [sortedCats]
  );
  const weaknesses = useMemo(() => sortedCats.slice(-2), [sortedCats]);

  // Destaques por dia
  const dailyExtremes = useMemo(() => {
    return evaluatedDays.map((d) => {
      const scores = CATEGORIAS.map((k) => ({
        key: k,
        label: CATEGORIA_LABEL[k],
        nota: average(d.pontuacoes[k]),
      })).filter((s) => s.nota > 0); // Filtrar apenas pontuações válidas
      
      if (scores.length === 0) {
        return { day: d.data ?? `Dia ${d.dia}`, high: undefined as any, low: undefined as any };
      }
      
      const high = scores.reduce((m, s) => (s.nota > m.nota ? s : m), scores[0]);
      const low = scores.reduce((m, s) => (s.nota < m.nota ? s : m), scores[0]);
      return { day: d.data ?? `Dia ${d.dia}`, high, low };
    });
  }, [evaluatedDays]);

  const strengthsAll = useMemo(() => sortedCats.filter((c) => c.nota >= 8), [sortedCats]);
  const improvementsAll = useMemo(() => sortedCats.filter((c) => c.nota < 7), [sortedCats]);

  const perDayAvg = useMemo(
    () =>
      (state?.avaliacoes ?? []).map((d) => {
        const catMedias = CATEGORIAS.map((k) => average(d.pontuacoes[k]));
        return { day: d.data ?? `Dia ${d.dia}`, media: average(catMedias) };
      }),
    [state]
  );

  const subtopicChartData = useMemo(() => {
    return CATEGORIAS.map((k) => {
      const arr: [number, number, number] = [0, 0, 0];
      if (evaluatedDays.length) {
        arr[0] = average(evaluatedDays.map((d) => d.pontuacoes[k][0]));
        arr[1] = average(evaluatedDays.map((d) => d.pontuacoes[k][1]));
        arr[2] = average(evaluatedDays.map((d) => d.pontuacoes[k][2]));
      }
      return { catKey: k, categoria: CATEGORIA_LABEL[k], s1: arr[0], s2: arr[1], s3: arr[2] };
    });
  }, [evaluatedDays]);

  const allDaysCompleted = useMemo(() => {
    const dias = state?.dias ?? 0;
    const avals = state?.avaliacoes ?? [];
    if (!dias || avals.length < dias) return false;
    return avals.every((d) => {
      if (d.presente === false) return true; // ausência conta como concluído
      return CATEGORIAS.some((k) => d.pontuacoes[k].some((v) => v > 0));
    });
  }, [state?.avaliacoes, state?.dias]);

  const status = useMemo(() => {
    if (!allDaysCompleted)
      return { label: 'Em avaliação', color: 'muted' as const };
    if ((state?.dias ?? 0) > 0 && freqPercent < 70)
      return { label: 'Reprovado por frequência', color: 'destructive' as const };
    if (overallAverage >= 8) return { label: 'Aprovado', color: 'primary' as const };
    if (overallAverage >= 7 && overallAverage < 8)
      return {
        label: 'Aprovado com nota mínima (requer melhoria)',
        color: 'secondary' as const,
      };
    if (overallAverage < 7) return { label: 'Reprovado', color: 'destructive' as const };
    return { label: 'Em avaliação', color: 'muted' as const };
  }, [overallAverage, freqPercent, state?.dias, allDaysCompleted]);

  const onExport = async () => {
    if (!reportRef.current) return;
    try {
      const root = getComputedStyle(document.documentElement);
      const bg = `hsl(${root.getPropertyValue('--background').trim()})`;
      
      // Capturar todas as variáveis CSS do tema
      const styleVars: Record<string, string> = {
        '--background': `hsl(${root.getPropertyValue('--background').trim()})`,
        '--foreground': `hsl(${root.getPropertyValue('--foreground').trim()})`,
        '--primary': `hsl(${root.getPropertyValue('--primary').trim()})`,
        '--primary-foreground': `hsl(${root.getPropertyValue('--primary-foreground').trim()})`,
        '--card': `hsl(${root.getPropertyValue('--card').trim()})`,
        '--card-foreground': `hsl(${root.getPropertyValue('--card-foreground').trim()})`,
        '--muted': `hsl(${root.getPropertyValue('--muted').trim()})`,
        '--muted-foreground': `hsl(${root.getPropertyValue('--muted-foreground').trim()})`,
        '--accent': `hsl(${root.getPropertyValue('--accent').trim()})`,
        '--accent-foreground': `hsl(${root.getPropertyValue('--accent-foreground').trim()})`,
        '--destructive': `hsl(${root.getPropertyValue('--destructive').trim()})`,
        '--destructive-foreground': `hsl(${root.getPropertyValue('--destructive-foreground').trim()})`,
        '--border': `hsl(${root.getPropertyValue('--border').trim()})`,
        '--input': `hsl(${root.getPropertyValue('--input').trim()})`,
        '--ring': `hsl(${root.getPropertyValue('--ring').trim()})`,
        '--secondary': `hsl(${root.getPropertyValue('--secondary').trim()})`,
        '--secondary-foreground': `hsl(${root.getPropertyValue('--secondary-foreground').trim()})`,
      };

      // Cria um wrapper temporário com as variáveis de tema aplicadas
      const wrapper = document.createElement('div');
      wrapper.className = 'min-h-screen';
      Object.entries(styleVars).forEach(([k, v]) => wrapper.style.setProperty(k, v));
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.backgroundColor = bg;
      wrapper.style.color = `hsl(${root.getPropertyValue('--foreground').trim()})`;
      wrapper.style.fontFamily = getComputedStyle(document.body).fontFamily;
      
      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      
      // Adicionar logo se existir
      if (state?.logoBase64) {
        const logoContainer = document.createElement('div');
        logoContainer.className = 'flex justify-center mb-6';
        logoContainer.innerHTML = `<img src="${state.logoBase64}" alt="Logo" class="h-16 w-auto object-contain" />`;
        clone.insertBefore(logoContainer, clone.firstChild);
      }
      
      wrapper.appendChild(clone);
      wrapper.style.width = `${reportRef.current.offsetWidth}px`;
      wrapper.style.padding = '2rem';
      document.body.appendChild(wrapper);

      const dataUrl = await htmlToImage.toPng(wrapper, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bg,
        skipFonts: false,
        includeQueryParams: true,
        style: styleVars,
      });

      wrapper.remove();
      const a = document.createElement('a');
      const safeNome = (state?.candidato?.nome || 'candidato').replace(/\s+/g, '_');
      a.download = `relatorio_${safeNome}.png`;
      a.href = dataUrl;
      a.click();
      toast({ title: 'Relatório exportado', description: 'O PNG foi gerado com cores e logo incluídos.' });
    } catch (e) {
      console.error('Erro na exportação:', e);
      toast({ title: 'Falha ao exportar', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  if (!state) {
    return (
      <main className="container py-10">
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <p className="text-muted-foreground">Não foi possível carregar o relatório.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="container pb-12 pt-8">
        <h1 className="text-3xl font-bold tracking-tight">Relatório do Treinamento</h1>

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
                  {state.avaliacoes?.[0]?.data && state.avaliacoes?.[state.avaliacoes.length-1]?.data
                    ? `${state.avaliacoes[0]?.data} – ${state.avaliacoes[state.avaliacoes.length-1]?.data}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Candidato</div>
                <div className="font-semibold">
                  {state.candidato.nome || '—'}
                  {state.candidato.idade ? `, ${state.candidato.idade} anos` : ''}
                </div>
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
            <CardContent className="space-y-4">
              <div>
                <div className="font-medium">Destaques por dia</div>
                <div className="mt-2 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dia</TableHead>
                        <TableHead>Ponto com maior média</TableHead>
                        <TableHead>Ponto com menor média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyExtremes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-muted-foreground">Sem avaliações diárias.</TableCell>
                        </TableRow>
                      ) : (
                        dailyExtremes.map((d) => (
                          <TableRow key={d.day}>
                            <TableCell className="whitespace-nowrap">{d.day}</TableCell>
                            {d.high && d.low ? (
                              <>
                                <TableCell>{d.high.label} ({d.high.nota.toFixed(1)})</TableCell>
                                <TableCell>{d.low.label} ({d.low.nota.toFixed(1)})</TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell colSpan={2} className="text-muted-foreground">Sem avaliação</TableCell>
                              </>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <div className="font-medium">Resumo final</div>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Pontos fortes</div>
                    <ul className="list-disc pl-5 text-sm">
                      {strengthsAll.length ? (
                        strengthsAll.map((s) => (
                          <li key={s.label}>{s.label}: {s.nota.toFixed(1)}</li>
                        ))
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Campos de melhoria</div>
                    <ul className="list-disc pl-5 text-sm">
                      {improvementsAll.length ? (
                        improvementsAll.map((s) => (
                          <li key={s.label}>{s.label}: {s.nota.toFixed(1)}</li>
                        ))
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Médias por dia</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perDayAvg}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="media" name="Média" fill={colors.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Média por competência</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={CATEGORIAS.map((k) => ({
                      categoria: CATEGORIA_LABEL[k],
                      nota: categoryOverall[k],
                    }))}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="categoria" />
                    <PolarRadiusAxis domain={[0, 10]} />
                    <Radar
                      name="Média"
                      dataKey="nota"
                      stroke={colors.primary}
                      fill={colors.primary}
                      fillOpacity={0.3}
                    />
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
            <CardContent style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perDayAvg}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="media"
                    name="Média"
                    stroke={colors.primary}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <div className="mt-4 flex justify-end">
          <Button onClick={onExport}>
            <Download className="mr-2 h-4 w-4" /> Exportar relatório (PNG)
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ShareReport;
