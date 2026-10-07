import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wind, FileText, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-vestas-blue-light">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
              <Wind className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Vestas Planejamento</h1>
              <p className="text-muted-foreground">Sistema de Gestão de Manutenção</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card 
            className="shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate("/maintenance-analysis")}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Análise da Manutenção</CardTitle>
                  <CardDescription>
                    Planejamento e sequenciamento de serviços
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Defina parâmetros de manutenção, organize sequências de execução e 
                gere cronogramas detalhados por equipe.
              </p>
              <Button className="w-full">
                Acessar Análise
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate("/schedule")}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Criação do Cronograma em PDF</CardTitle>
                  <CardDescription>
                    Geração de cronogramas em formato PDF
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Importe atividades de planilhas e gere cronogramas formatados 
                em PDF com diagrama de Gantt.
              </p>
              <Button className="w-full">
                Acessar Gerador
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
