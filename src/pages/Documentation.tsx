import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Home } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';

const Documentation = () => {
  const docRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const onExportPDF = async () => {
    if (!docRef.current) return;
    try {
      toast({ title: 'Gerando PDF...', description: 'Por favor aguarde.' });
      
      const element = docRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const margin = 10;
      const availableWidth = pdfWidth - (2 * margin);
      const ratio = availableWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      // Calcular quantas páginas são necessárias
      let remainingHeight = scaledHeight;
      let currentY = margin;
      let pageCount = 0;

      while (remainingHeight > 0) {
        if (pageCount > 0) {
          pdf.addPage();
        }

        const pageContentHeight = Math.min(pdfHeight - (2 * margin), remainingHeight);
        const sourceY = pageCount * (pdfHeight - (2 * margin)) / ratio;

        // Criar um canvas temporário para esta página
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = (pageContentHeight / ratio);
        const ctx = pageCanvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(
            canvas,
            0, sourceY,
            canvas.width, pageCanvas.height,
            0, 0,
            pageCanvas.width, pageCanvas.height
          );

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 1.0);
          pdf.addImage(pageImgData, 'JPEG', margin, margin, availableWidth, pageContentHeight);
        }

        remainingHeight -= pageContentHeight;
        pageCount++;
      }

      pdf.save('documentacao_sistema_avaliacao_treinamento.pdf');
      
      toast({ title: 'PDF exportado com sucesso!', description: 'A documentação foi gerada.' });
    } catch (e) {
      console.error('Erro na exportação PDF:', e);
      toast({ title: 'Falha ao exportar PDF', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container pb-12 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Documentação do Sistema</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/')} variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Voltar ao Sistema
            </Button>
            <Button onClick={onExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <div ref={docRef} className="space-y-8 bg-white p-8">
          {/* Cabeçalho */}
          <div className="text-center border-b pb-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Sistema de Avaliação de Treinamento
            </h1>
            <p className="text-lg text-gray-600">Manual do Usuário - Versão 1.0</p>
          </div>

          {/* Índice */}
          <Card>
            <CardHeader>
              <CardTitle>Índice</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2">
                <li className="font-semibold">Visão Geral do Sistema</li>
                <li className="font-semibold">Primeiros Passos</li>
                <li className="font-semibold">Cadastro de Treinamento</li>
                <li className="font-semibold">Gerenciamento de Participantes</li>
                <li className="font-semibold">Registro de Avaliações Diárias</li>
                <li className="font-semibold">Visualização de Relatórios</li>
                <li className="font-semibold">Exportação e Compartilhamento</li>
                <li className="font-semibold">Critérios de Avaliação</li>
                <li className="font-semibold">Perguntas Frequentes</li>
              </ol>
            </CardContent>
          </Card>

          {/* 1. Visão Geral */}
          <Card>
            <CardHeader>
              <CardTitle>1. Visão Geral do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">O que é o Sistema?</h3>
                <p className="text-gray-700">
                  O Sistema de Avaliação de Treinamento é uma ferramenta completa para registrar, 
                  acompanhar e avaliar o desempenho de participantes em treinamentos. Permite o 
                  registro detalhado de avaliações diárias em 6 competências principais, geração 
                  de relatórios automáticos com gráficos e exportação em múltiplos formatos.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mb-2">Principais Funcionalidades</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>Cadastro de informações do treinamento (nome, local, período, carga horária)</li>
                  <li>Gerenciamento de múltiplos participantes</li>
                  <li>Avaliação detalhada em 6 competências com 3 subtópicos cada</li>
                  <li>Controle de presença diária</li>
                  <li>Upload de foto do participante e logo da empresa</li>
                  <li>Gráficos automáticos de desempenho (linha, radar, barras)</li>
                  <li>Geração de relatórios completos em PDF e PNG</li>
                  <li>Compartilhamento de relatórios via link</li>
                  <li>Upload de logo da empresa para relatórios</li>
                  <li>Cálculo automático de médias e status de aprovação</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Competências Avaliadas</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="border p-3 rounded">
                    <strong>Segurança</strong>
                    <p className="text-sm text-gray-600">Prevenção, EPI, Procedimentos</p>
                  </div>
                  <div className="border p-3 rounded">
                    <strong>Técnica</strong>
                    <p className="text-sm text-gray-600">Conhecimento, Execução, Eficiência</p>
                  </div>
                  <div className="border p-3 rounded">
                    <strong>Comunicação</strong>
                    <p className="text-sm text-gray-600">Clareza, Assertividade, Consistência</p>
                  </div>
                  <div className="border p-3 rounded">
                    <strong>Aptidão Física</strong>
                    <p className="text-sm text-gray-600">Resistência, Força, Agilidade</p>
                  </div>
                  <div className="border p-3 rounded">
                    <strong>Liderança</strong>
                    <p className="text-sm text-gray-600">Motivação, Gestão de Conflitos, Tomada de Decisão</p>
                  </div>
                  <div className="border p-3 rounded">
                    <strong>Operacional</strong>
                    <p className="text-sm text-gray-600">Planejamento, Cacipe, Operação</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Primeiros Passos */}
          <Card>
            <CardHeader>
              <CardTitle>2. Primeiros Passos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Como Começar</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Acesse o sistema através do navegador web</li>
                  <li>A tela principal apresentará 4 abas: Cadastro, Participantes, Avaliação e Relatório</li>
                  <li>Comece pela aba "Cadastro" para configurar seu treinamento</li>
                  <li>Em seguida, adicione participantes na aba "Participantes"</li>
                  <li>Realize as avaliações diárias na aba "Avaliação"</li>
                  <li>Visualize e exporte resultados na aba "Relatório"</li>
                </ol>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="font-semibold text-blue-900">💡 Dica Importante</p>
                <p className="text-blue-800 text-sm mt-1">
                  Todos os dados são salvos automaticamente no navegador. Não é necessário 
                  clicar em "Salvar". Use sempre o mesmo navegador e computador para acessar 
                  seus dados.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Cadastro de Treinamento */}
          <Card>
            <CardHeader>
              <CardTitle>3. Cadastro de Treinamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Informações Básicas</h3>
                <div className="space-y-3">
                  <div>
                    <strong>Nome do Treinamento:</strong>
                    <p className="text-sm text-gray-600">
                      Digite o nome ou título do treinamento (ex: "Treinamento de Segurança em Altura")
                    </p>
                  </div>
                  <div>
                    <strong>Local:</strong>
                    <p className="text-sm text-gray-600">
                      Informe o local onde o treinamento será realizado (ex: "Campo de Treinamento - São Paulo")
                    </p>
                  </div>
                  <div>
                    <strong>Número de Dias:</strong>
                    <p className="text-sm text-gray-600">
                      Use o controle deslizante para definir a duração do treinamento (1 a 30 dias). 
                      A carga horária será calculada automaticamente (8 horas por dia).
                    </p>
                  </div>
                  <div>
                    <strong>Data de Início:</strong>
                    <p className="text-sm text-gray-600">
                      Clique no campo para abrir o calendário e selecione a data de início. 
                      A data final será calculada automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Informações Adicionais</h3>
                <div className="space-y-3">
                  <div>
                    <strong>Instrutores:</strong>
                    <p className="text-sm text-gray-600">
                      Informe os nomes dos instrutores responsáveis, separados por vírgula 
                      (ex: "João Silva, Maria Santos")
                    </p>
                  </div>
                  <div>
                    <strong>Empresa:</strong>
                    <p className="text-sm text-gray-600">
                      Digite o nome da empresa ou instituição responsável pelo treinamento
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Upload de Logo</h3>
                <p className="text-gray-700 mb-2">
                  Clique em "Escolher Logo" para fazer upload do logotipo da empresa. 
                  O logo aparecerá no relatório exportado.
                </p>
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Formatos aceitos: PNG, JPG, JPEG. Recomendado: imagem com fundo transparente (PNG).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Gerenciamento de Participantes */}
          <Card>
            <CardHeader>
              <CardTitle>4. Gerenciamento de Participantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Adicionar Novo Participante</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Acesse a aba "Participantes"</li>
                  <li>Preencha o campo "Nome do Participante"</li>
                  <li>Opcionalmente, informe a idade</li>
                  <li>Clique em "Adicionar Participante"</li>
                  <li>O participante aparecerá na lista abaixo</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Upload de Foto do Participante</h3>
                <p className="text-gray-700 mb-2">
                  Ao selecionar um participante, você pode fazer upload de uma foto que 
                  aparecerá no relatório individual:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                  <li>Selecione o participante na lista</li>
                  <li>Clique em "Escolher Foto"</li>
                  <li>Selecione a imagem do arquivo</li>
                  <li>A foto será salva automaticamente</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Selecionar Participante Ativo</h3>
                <p className="text-gray-700">
                  Para realizar avaliações, você precisa selecionar qual participante está sendo avaliado:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>Clique no nome do participante na lista</li>
                  <li>O participante selecionado ficará destacado</li>
                  <li>As avaliações serão registradas para este participante</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Excluir Participante</h3>
                <p className="text-gray-700 mb-2">
                  Para remover um participante:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                  <li>Localize o participante na lista</li>
                  <li>Clique no botão "Excluir" ao lado do nome</li>
                  <li>Confirme a exclusão</li>
                </ol>
                <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-2">
                  <p className="text-sm text-red-800">
                    ⚠️ ATENÇÃO: Excluir um participante apagará permanentemente todas as suas avaliações!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Registro de Avaliações */}
          <Card>
            <CardHeader>
              <CardTitle>5. Registro de Avaliações Diárias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Como Avaliar um Participante</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                  <li>Certifique-se de que um participante está selecionado</li>
                  <li>Acesse a aba "Avaliação"</li>
                  <li>Selecione o dia que deseja avaliar clicando na aba correspondente</li>
                  <li>Marque ou desmarque "Presente" conforme a situação</li>
                  <li>Para cada competência, avalie os 3 subtópicos usando os controles deslizantes (0 a 10)</li>
                  <li>As médias são calculadas automaticamente</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Escala de Avaliação</h3>
                <div className="border rounded p-3">
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div>
                      <div className="font-bold text-red-600">0-2</div>
                      <div className="text-xs">Insuficiente</div>
                    </div>
                    <div>
                      <div className="font-bold text-orange-600">3-5</div>
                      <div className="text-xs">Regular</div>
                    </div>
                    <div>
                      <div className="font-bold text-yellow-600">6-7</div>
                      <div className="text-xs">Bom</div>
                    </div>
                    <div>
                      <div className="font-bold text-blue-600">8-9</div>
                      <div className="text-xs">Muito Bom</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">10</div>
                      <div className="text-xs">Excelente</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Controle de Presença</h3>
                <p className="text-gray-700">
                  Ao desmarcar "Presente", os controles de avaliação serão desabilitados para aquele dia. 
                  As ausências são contabilizadas no cálculo de frequência.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Visualização em Tempo Real</h3>
                <p className="text-gray-700">
                  Ao avaliar, você verá em tempo real:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                  <li>Média de cada competência (média dos 3 subtópicos)</li>
                  <li>Média geral do dia</li>
                  <li>Indicadores visuais de desempenho</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 6. Visualização de Relatórios */}
          <Card>
            <CardHeader>
              <CardTitle>6. Visualização de Relatórios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Acessar o Relatório</h3>
                <p className="text-gray-700 mb-2">
                  Acesse a aba "Relatório" para visualizar todas as análises e resultados do participante selecionado.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Seções do Relatório</h3>
                <div className="space-y-3">
                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Resumo</strong>
                    <p className="text-sm text-gray-600">
                      Informações gerais: nome do treinamento, local, período, candidato, 
                      instrutores e empresa.
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Informações Gerais</strong>
                    <p className="text-sm text-gray-600">
                      Foto do participante, frequência, status de aprovação e média geral.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Gráfico de Desempenho Diário</strong>
                    <p className="text-sm text-gray-600">
                      Gráfico de linha mostrando a evolução da média geral ao longo dos dias.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Análise por Competência</strong>
                    <p className="text-sm text-gray-600">
                      Gráfico radar mostrando o desempenho em cada uma das 6 competências.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Detalhamento dos Subtópicos</strong>
                    <p className="text-sm text-gray-600">
                      Gráfico de barras agrupadas mostrando a pontuação em cada subtópico 
                      de cada competência.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Destaques por Dia</strong>
                    <p className="text-sm text-gray-600">
                      Tabela mostrando a competência com melhor e pior desempenho em cada dia.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Pontos Fortes e Fracos</strong>
                    <p className="text-sm text-gray-600">
                      Lista das competências em que o participante teve melhor e pior desempenho.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-3">
                    <strong>Resumo Final</strong>
                    <p className="text-sm text-gray-600">
                      Análise geral com recomendações baseadas no desempenho do participante.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7. Exportação e Compartilhamento */}
          <Card>
            <CardHeader>
              <CardTitle>7. Exportação e Compartilhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Exportar em PDF</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                  <li>Acesse a aba "Relatório"</li>
                  <li>Clique no botão "Exportar PDF"</li>
                  <li>Aguarde a geração do arquivo</li>
                  <li>O PDF será baixado automaticamente</li>
                </ol>
                <p className="text-sm text-gray-600 mt-2">
                  O PDF inclui todas as seções do relatório, gráficos e o logo da empresa.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Exportar em PNG</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                  <li>Acesse a aba "Relatório"</li>
                  <li>Clique no botão "Exportar PNG"</li>
                  <li>A imagem será baixada com o nome do participante</li>
                </ol>
                <p className="text-sm text-gray-600 mt-2">
                  Ideal para compartilhamento rápido em mensagens ou apresentações.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Gerar Link de Compartilhamento</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                  <li>Acesse a aba "Relatório"</li>
                  <li>Clique no botão "Gerar Link"</li>
                  <li>O link será copiado automaticamente</li>
                  <li>Cole e compartilhe o link com outras pessoas</li>
                </ol>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mt-2">
                  <p className="text-sm text-blue-800">
                    💡 O link pode ser aberto em qualquer navegador e permite visualizar 
                    e exportar o relatório sem precisar acessar o sistema.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Copiar Dados</h3>
                <p className="text-gray-700">
                  Use o botão "Copiar Dados" para copiar as informações em formato JSON, 
                  útil para backup ou transferência entre dispositivos.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 8. Critérios de Avaliação */}
          <Card>
            <CardHeader>
              <CardTitle>8. Critérios de Avaliação e Aprovação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Cálculo de Médias</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>Média de Competência:</strong> média dos 3 subtópicos</li>
                  <li><strong>Média Diária:</strong> média das 6 competências do dia</li>
                  <li><strong>Média Geral:</strong> média de todos os dias avaliados (apenas dias presentes)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Status de Aprovação</h3>
                <div className="space-y-2">
                  <div className="border-l-4 border-green-500 pl-3">
                    <strong className="text-green-700">Aprovado</strong>
                    <p className="text-sm text-gray-600">
                      Média geral ≥ 8.0 e frequência ≥ 70%
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-yellow-500 pl-3">
                    <strong className="text-yellow-700">Aprovado com nota mínima</strong>
                    <p className="text-sm text-gray-600">
                      Média geral entre 7.0 e 7.9 e frequência ≥ 70% (requer melhoria)
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-3">
                    <strong className="text-red-700">Reprovado</strong>
                    <p className="text-sm text-gray-600">
                      Média geral &lt; 7.0 ou frequência &lt; 70%
                    </p>
                  </div>

                  <div className="border-l-4 border-gray-500 pl-3">
                    <strong className="text-gray-700">Em avaliação</strong>
                    <p className="text-sm text-gray-600">
                      Nem todos os dias foram avaliados ainda
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Frequência Mínima</h3>
                <p className="text-gray-700">
                  É necessário ter presença em pelo menos 70% dos dias do treinamento para aprovação.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 9. Perguntas Frequentes */}
          <Card>
            <CardHeader>
              <CardTitle>9. Perguntas Frequentes (FAQ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Os dados são salvos automaticamente?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Sim! Todos os dados são salvos automaticamente no navegador. 
                  Não há necessidade de clicar em botões de salvar.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Posso acessar de outro computador?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Os dados ficam salvos localmente no navegador. Para acessar 
                  de outro dispositivo, use o botão "Copiar Dados" e depois "Importar Dados" 
                  no outro dispositivo.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Posso avaliar múltiplos participantes no mesmo treinamento?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Sim! Adicione todos os participantes na aba "Participantes" 
                  e selecione um de cada vez para realizar as avaliações.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Como faço backup dos dados?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Use o botão "Copiar Dados" na aba Relatório e salve o texto 
                  copiado em um arquivo de texto. Para restaurar, use "Importar Dados".
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Posso editar avaliações já registradas?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Sim! Basta acessar a aba "Avaliação", selecionar o dia 
                  desejado e ajustar as pontuações. As alterações são salvas automaticamente.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: O que acontece se eu limpar o cache do navegador?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Todos os dados serão perdidos! Recomendamos fazer backup 
                  regular usando "Copiar Dados" ou exportando relatórios em PDF.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Como alterar o número de dias após iniciar as avaliações?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Você pode ajustar na aba "Cadastro". Se aumentar, novos dias 
                  serão adicionados. Se diminuir, os dias excedentes serão removidos.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: O link de compartilhamento expira?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Não! O link contém todos os dados do relatório e funciona 
                  indefinidamente. Qualquer pessoa com o link pode visualizar e exportar o relatório.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Qual a diferença entre PNG e PDF?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> PNG é uma imagem estática, ideal para compartilhamento rápido. 
                  PDF é um documento multipáginas com melhor qualidade para impressão e arquivo oficial.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-1">
                  P: Posso imprimir o relatório?
                </h3>
                <p className="text-gray-700 text-sm">
                  <strong>R:</strong> Sim! Exporte em PDF e imprima o arquivo. O PDF garante 
                  melhor qualidade de impressão.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rodapé */}
          <div className="border-t pt-6 text-center text-sm text-gray-600">
            <p>Sistema de Avaliação de Treinamento - Versão 1.0</p>
            <p className="mt-1">Documentação gerada automaticamente</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
