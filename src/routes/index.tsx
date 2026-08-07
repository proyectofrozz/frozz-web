import { createFileRoute } from "@tanstack/react-router";
import { ProjectsTable } from '@/components/ProjectsTable';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Dashboard FROZZ</h1>
      <ProjectsTable />
    </div>
  );
}
import { FrozzMes } from "@/components/mes/FrozzMes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FROZZ MES — Seguimiento de Producción" },
      {
        name: "description",
        content:
          "Sistema de Ejecución de Manufactura (MES) para FROZZ. Seguimiento en tiempo real de proyectos de refrigeración: corte, doblez, soldadura, pintura, eléctrica, refrigeración y ensamblaje.",
      },
      { property: "og:title", content: "FROZZ MES — Seguimiento de Producción" },
      {
        property: "og:description",
        content:
          "Tablero Kanban en tiempo real con vistas por estación y panel de planeación para gerencia.",
      },
    ],
  }),
  component: FrozzMes,
});
