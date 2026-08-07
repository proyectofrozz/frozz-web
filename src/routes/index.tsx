import { createFileRoute } from "@tanstack/react-router";
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
