// src/components/ProjectsTable.tsx
// Componente para mostrar tabla de proyectos sincronizados con Notion

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface Proyecto {
  id: string;
  codigoProyecto: string;
  equipo: string;
  cliente: string;
  personaACargo: string;
  fechaInicio: string;
  fechaEstimadaEntrega: string;
  estado: string;
  avance: number;
  prioridad: string;
  entradaAEstacion: string;
}

export function ProjectsTable() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Proyecto>>({});
  const [syncing, setSyncing] = useState(false);

  // Cargar datos de Notion
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notion/read');
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProyectos(data.proyectos);
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

  // Actualizar un proyecto
  const handleUpdate = async (pageId: string) => {
    try {
      setSyncing(true);
      const response = await fetch('/api/notion/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          ...editingData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      toast.success('Proyecto actualizado en Notion');
      setEditingId(null);
      setEditingData({});
      fetchProjects(); // Recarga los datos
    } catch (err: any) {
      toast.error('Error al actualizar proyecto: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Editar un campo
  const handleEdit = (proyecto: Proyecto) => {
    setEditingId(proyecto.id);
    setEditingData({ ...proyecto });
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
            Error: {error}
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
                      <TableCell>
                        <Input
                          value={editingData.codigoProyecto || ''}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              codigoProyecto: e.target.value,
                            })
                          }
                          className="w-24"
                        />
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
                          value={editingData.estado || ''}
                          onValueChange={(value) =>
                            setEditingData({
                              ...editingData,
                              estado: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Por Iniciar">Por Iniciar</SelectItem>
                            <SelectItem value="En Progreso">En Progreso</SelectItem>
                            <SelectItem value="Completado">Completado</SelectItem>
                            <SelectItem value="Pausado">Pausado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingData.avance || 0}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData,
                              avance: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20"
                          max="100"
                          min="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editingData.prioridad || ''}
                          onValueChange={(value) =>
                            setEditingData({
                              ...editingData,
                              prioridad: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Alta">Alta</SelectItem>
                            <SelectItem value="Media">Media</SelectItem>
                            <SelectItem value="Baja">Baja</SelectItem>
                          </SelectContent>
                        </Select>
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
                            onClick={() => handleUpdate(proyecto.id)}
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
                      <TableCell className="font-medium">
                        {proyecto.codigoProyecto}
                      </TableCell>
                      <TableCell>{proyecto.equipo}</TableCell>
                      <TableCell>{proyecto.cliente}</TableCell>
                      <TableCell>{proyecto.personaACargo}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            proyecto.estado === 'Completado'
                              ? 'bg-green-100 text-green-800'
                              : proyecto.estado === 'En Progreso'
                              ? 'bg-blue-100 text-blue-800'
                              : proyecto.estado === 'Pausado'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {proyecto.estado}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${proyecto.avance}%` }}
                          ></div>
                        </div>
                        <span className="text-xs">{proyecto.avance}%</span>
                      </TableCell>
                      <TableCell>{proyecto.prioridad}</TableCell>
                      <TableCell>
                        {new Date(proyecto.fechaEstimadaEntrega).toLocaleDateString(
                          'es-CO'
                        )}
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
        <div className="mt-4 text-xs text-gray-500">
          ✨ Los datos se sincronizan automáticamente cada día. Última actualización: ahora
        </div>
      </CardContent>
    </Card>
  );
}
