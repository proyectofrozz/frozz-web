// src/components/ProjectsTable.tsx
// Tabla de proyectos sincronizada con Notion, usando el modelo centralizado
// en src/lib/notion/mapper.ts (misma fuente de verdad que FrozzMes).

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ORDEN_ESTACIONES,
  ESTADO_INICIAL,
  formatProjectCode,
  orSinInformacion,
  type Proyecto,
  type EstadoProyecto,
} from '@/lib/notion/mapper';

type EditableFields = Partial<
  Pick<
    Proyecto,
    'equipo' | 'cliente' | 'personaACargo' | 'estado' | 'avance' | 'prioridad' | 'fechaEstimadaEntrega'
  >
>;

const ESTADOS_DISPONIBLES: EstadoProyecto[] = [ESTADO_INICIAL, ...ORDEN_ESTACIONES];

export function ProjectsTable() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditableFields>({});
  const [syncing, setSyncing] = useState(false);

  // Cargar datos reales de Notion
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notion/read');

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProyectos(data.proyectos ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Actualizar un proyecto en Notion, identificado por notionPageId
  const handleUpdate = async (notionPageId: string) => {
    try {
      setSyncing(true);
      const response = await fetch('/api/notion/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionPageId,
          ...editingData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      toast.success('Proyecto actualizado en Notion');
      setEditingId(null);
      setEditingData({});
      fetchProjects(); // Recarga los datos reales desde Notion
    } catch (err: any) {
      toast.error('Error al actualizar proyecto: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Editar un campo
  const handleEdit = (proyecto: Proyecto) => {
    setEditingId(proyecto.id);
    setEditingData({
      equipo: proyecto.equipo,
      cliente: proyecto.cliente,
      personaACargo: proyecto.personaACargo,
      estado: proyecto.estado,
      avance: proyecto.avance,
      prioridad: proyecto.prioridad,
      fechaEstimadaEntrega: proyecto.fechaEstimadaEntrega ?? '',
    });
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };

  // Sincronizar manualmente desde Notion
  const handleSync = async () => {
    setSyncing(true);
    await fetchProjects();
    setSyncing(false);
    toast.success('Datos sincronizados desde Notion');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proyectos FROZZ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Cargando proyectos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proyectos FROZZ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            No se pudieron cargar los proyectos: {error}
          </div>
          <Button onClick={fetchProjects} className="w-full">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Proyectos FROZZ ({proyectos.length})</CardTitle>
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          size="sm"
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
        </Button>
      </CardHeader>
      <CardContent>
        {proyectos.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay proyectos disponibles.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>F. Entrega</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyectos.map((proyecto) => (
                <TableRow key={proyecto.id}>
                  {editingId === proyecto.id ? (
                    <>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatProjectCode(proyecto.codigoProyecto)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editingData.equipo || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              equipo: e.target.value,
                            })
                          }
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editingData.cliente || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              cliente: e.target.value,
                            })
                          }
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editingData.personaACargo || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              personaACargo: e.target.value,
                            })
                          }
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editingData.estado || ESTADO_INICIAL}
                          onValueChange={(value) =>
                            setEditingData({
                              ...editingData,
                              estado: value as EstadoProyecto,
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADOS_DISPONIBLES.map((estado) => (
                              <SelectItem key={estado} value={estado}>
                                {estado}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingData.avance ?? 0}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              avance: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-20"
                          max="100"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editingData.prioridad || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              prioridad: e.target.value,
                            })
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={editingData.fechaEstimadaEntrega || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              fechaEstimadaEntrega: e.target.value,
                            })
                          }
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleUpdate(proyecto.notionPageId)}
                            disabled={syncing}
                            size="sm"
                            variant="default"
                          >
                            Guardar
                          </Button>
                          <Button
                            onClick={handleCancel}
                            size="sm"
                            variant="ghost"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium font-mono">
                        {formatProjectCode(proyecto.codigoProyecto)}
                      </TableCell>
                      <TableCell>{orSinInformacion(proyecto.equipo)}</TableCell>
                      <TableCell>{orSinInformacion(proyecto.cliente)}</TableCell>
                      <TableCell>{orSinInformacion(proyecto.personaACargo)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            proyecto.estado === 'Finalizado'
                              ? 'bg-green-100 text-green-800'
                              : proyecto.estado === 'Sin empezar'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {proyecto.estado}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, proyecto.avance))}%` }}
                          ></div>
                        </div>
                        <span className="text-xs">{proyecto.avance}%</span>
                      </TableCell>
                      <TableCell>{orSinInformacion(proyecto.prioridad)}</TableCell>
                      <TableCell>
                        {proyecto.fechaEstimadaEntrega
                          ? new Date(proyecto.fechaEstimadaEntrega).toLocaleDateString('es-CO')
                          : 'Sin información'}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleEdit(proyecto)}
                          size="sm"
                          variant="ghost"
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
