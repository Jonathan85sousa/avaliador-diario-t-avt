import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  const status = useMemo(() => {
    if ((state?.dias ?? 0) > 0 && freqPercent < 70)
      return { label: 'Reprovado por frequência', color: 'destructive' as const };
    if (overallAverage >= 8) return { label: 'Aprovado', color: 'primary' as const };
    if (overallAverage >= 7 && overallAverage < 8)
      return {
        label: 'Aprovado com nota mínima (requer melhoria)',
        color: 'secondary' as const,
      };
    if (overallAverage < 7) return { label: 'Reprovado', color: 'destructive' as const };
    return { label: 'Em análise', color: 'muted' as const };
  }, [overallAverage, freqPercent, state?.dias]);

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
      // Cria um wrapper temporário com as variáveis de tema aplicadas
      const wrapper = document.createElement('div');
      Object.entries(styleVars).forEach(([k, v]) => wrapper.style.setProperty(k, v));
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.backgroundColor = bg;
      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      wrapper.appendChild(clone);
      // manter dimensões
      wrapper.style.width = `${reportRef.current.offsetWidth}px`;
      document.body.appendChild(wrapper);

      const dataUrl = await htmlToImage.toPng(wrapper, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bg,
        skipFonts: false,
      });

      wrapper.remove();
      const a = document.createElement('a');
      const safeNome = (state?.candidato?.nome || 'candidato').replace(/\s+/g, '_');
      a.download = `relatorio_${safeNome}.png`;
      a.href = dataUrl;
      a.click();
      toast({ title: 'Relatório exportado', description: 'O PNG foi gerado com as cores.' });
    } catch (e) {
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
            <CardContent className="space-y-3">
              {status.label === 'Aprovado' && (
                <div className="space-y-2">
                  <p>Parabéns! O candidato foi aprovado. Pontos fortes:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {strengths.map((s) => (
                      <li key={s.label}>
                        {s.label}: {s.nota.toFixed(1)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Mantenha a consistência e continue avançando nesses aspectos.
                  </p>
                </div>
              )}

              {status.label.startsWith('Aprovado com') && (
                <div className="space-y-2">
                  <p>Aprovado com nota mínima. Atenção aos pontos fracos:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {weaknesses.map((s) => (
                      <li key={s.label}>
                        {s.label}: {s.nota.toFixed(1)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Recomenda-se plano de melhoria focado e revisão de procedimentos.
                  </p>
                </div>
              )}

              {status.label === 'Reprovado' && (
                <div className="space-y-2">
                  <p>Reprovado por desempenho. Principais pontos a melhorar:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {weaknesses.map((s) => (
                      <li key={s.label}>
                        {s.label}: {s.nota.toFixed(1)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Sugere-se refazer o treinamento após um plano de desenvolvimento direcionado.
                  </p>
                </div>
              )}

              {status.label === 'Reprovado por frequência' && (
                <div className="space-y-2">
                  <p>
                    Reprovado por frequência ({freqPercent}%). A frequência mínima exigida é 70%.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Agende nova participação garantindo presença suficiente para avaliação completa.
                  </p>
                </div>
              )}
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

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Subtópicos por competência (média)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subtopicChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="categoria" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip formatter={(value: any, _name: any, props: any) => {
                    try {
                      const dataKey = props.dataKey as 's1' | 's2' | 's3';
                      const idx = dataKey === 's1' ? 0 : dataKey === 's2' ? 1 : 2;
                      const catKey = props?.payload?.catKey as keyof Scores;
                      const label = SUBTOPICOS[catKey]?.[idx] ?? _name;
                      return [value as number, label];
                    } catch {
                      return [value as number, _name];
                    }
                  }} />
                  <Legend />
                  <Bar dataKey="s1" name="Subtópico 1" fill={colors.primary} />
                  <Bar dataKey="s2" name="Subtópico 2" fill={colors.primary} fillOpacity={0.8} />
                  <Bar dataKey="s3" name="Subtópico 3" fill={colors.primary} fillOpacity={0.6} />
                </BarChart>
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
