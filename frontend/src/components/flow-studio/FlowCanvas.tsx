import React, { useRef, useState, useEffect } from 'react';
import {
  Zap,
  MessageSquare,
  Image as ImageIcon,
  MousePointerClick,
  ExternalLink,
  Database,
  GitBranch,
  Clock,
  Globe,
  QrCode,
  Gamepad2,
  CheckCircle,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Workflow,
} from 'lucide-react';
import { FlowNode, FlowEdge, FlowNodeType } from '../../types/flows.js';

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  activeSimulatedNodeId?: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodes: (nodes: FlowNode[]) => void;
  onUpdateEdges: (edges: FlowEdge[]) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (node: FlowNode) => void;
  onAutoLayout?: () => void;
}

// Cores das portas e nós conforme especificação (Sucesso #37DC7E, Erro #EF5050, IA #447AF7, etc.)
export const PORT_COLORS: Record<string, string> = {
  trigger_keyword: '#f59e0b',
  message_text: '#37DC7E',
  message_media: '#a855f7',
  interactive_buttons: '#447AF7',
  hosted_page_button: '#6366f1',
  data_capture: '#06b6d4',
  condition: '#37DC7E',
  condition_true: '#37DC7E',
  condition_false: '#EF5050',
  wait_delay: '#f97316',
  http_request: '#14b8a6',
  pix_charge: '#84cc16',
  game_launcher: '#9561eb',
  end_flow: '#64748b',
};

export function getSourcePortColor(node?: FlowNode, handleId?: string): string {
  if (!node) return '#37DC7E';
  if (node.type === 'condition') {
    if (handleId === 'false') return PORT_COLORS.condition_false;
    return PORT_COLORS.condition_true;
  }
  return PORT_COLORS[node.type] || '#37DC7E';
}

const NODE_COLORS: Record<FlowNodeType, { bg: string; border: string; text: string; icon: any }> = {
  trigger_keyword: { bg: 'bg-amber-950/40', border: 'border-amber-500/40', text: 'text-amber-400', icon: Zap },
  message_text: { bg: 'bg-emerald-950/40', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: MessageSquare },
  message_media: { bg: 'bg-purple-950/40', border: 'border-purple-500/40', text: 'text-purple-400', icon: ImageIcon },
  interactive_buttons: { bg: 'bg-blue-950/40', border: 'border-blue-500/40', text: 'text-blue-400', icon: MousePointerClick },
  hosted_page_button: { bg: 'bg-indigo-950/40', border: 'border-indigo-500/40', text: 'text-indigo-400', icon: ExternalLink },
  data_capture: { bg: 'bg-cyan-950/40', border: 'border-cyan-500/40', text: 'text-cyan-400', icon: Database },
  condition: { bg: 'bg-pink-950/40', border: 'border-pink-500/40', text: 'text-pink-400', icon: GitBranch },
  wait_delay: { bg: 'bg-orange-950/40', border: 'border-orange-500/40', text: 'text-orange-400', icon: Clock },
  http_request: { bg: 'bg-teal-950/40', border: 'border-teal-500/40', text: 'text-teal-400', icon: Globe },
  pix_charge: { bg: 'bg-lime-950/40', border: 'border-lime-500/40', text: 'text-lime-400', icon: QrCode },
  game_launcher: { bg: 'bg-rose-950/40', border: 'border-rose-500/40', text: 'text-rose-400', icon: Gamepad2 },
  end_flow: { bg: 'bg-gray-900/60', border: 'border-gray-500/40', text: 'text-gray-400', icon: CheckCircle },
};

// Gerador do raio elétrico (8-12 segmentos, ruído, amplitude máx 7px, afunilando nas pontas, fio central 0.9px)
function generateLightningPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tick: number
): { mainPath: string; branchPath: string } {
  const segments = 10;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const points: [number, number][] = [[x1, y1]];
  let branchOrigin: [number, number] = [x1, y1];

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    // Amplitude que afunila nas extremidades (t=0 -> 0, t=0.5 -> máx 7px, t=1 -> 0)
    const envelope = Math.sin(t * Math.PI);
    const noise = Math.sin(tick * 3.7 + i * 5.3) * 0.6 + Math.cos(tick * 2.1 + i * 7.1) * 0.4;
    const displacement = noise * 7 * envelope;

    const px = x1 + dx * t + nx * displacement;
    const py = y1 + dy * t + ny * displacement;
    points.push([px, py]);

    if (i === 7) {
      branchOrigin = [px, py];
    }
  }
  points.push([x2, y2]);

  const mainPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

  // Ramo secundário fino a 80% do comprimento
  const branchAngle = Math.atan2(dy, dx) + (Math.sin(tick * 1.5) > 0 ? 0.65 : -0.65);
  const branchLen = Math.min(22, len * 0.25);
  const bx = branchOrigin[0] + Math.cos(branchAngle) * branchLen;
  const by = branchOrigin[1] + Math.sin(branchAngle) * branchLen;
  const branchPath = `M ${branchOrigin[0].toFixed(1)} ${branchOrigin[1].toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)}`;

  return { mainPath, branchPath };
}

interface SnappedTarget {
  nodeId: string;
  x: number;
  y: number;
  portColor: string;
}

interface ConnectingEffectState {
  targetNodeId: string;
  edgeId: string;
  color: string;
  createdAt: number;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  activeSimulatedNodeId,
  onSelectNode,
  onUpdateNodes,
  onUpdateEdges,
  onDeleteNode,
  onDuplicateNode,
  onAutoLayout,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting state
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [snappedTarget, setSnappedTarget] = useState<SnappedTarget | null>(null);

  // Efeitos pós-conexão (flash da aresta, ripple, barra de luz e cometas contornando a borda)
  const [connectingEffect, setConnectingEffect] = useState<ConnectingEffectState | null>(null);

  // Ticker de 50ms (20Hz) para embaralhar o raio elétrico
  const [lightningTick, setLightningTick] = useState(0);

  useEffect(() => {
    if (!connectingSource || !snappedTarget) return;
    const interval = setInterval(() => {
      setLightningTick((t) => (t + 1) % 1000);
    }, 50);
    return () => clearInterval(interval);
  }, [connectingSource, snappedTarget]);

  // Handle Canvas Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.flow-node-card') || (e.target as HTMLElement).closest('.flow-handle')) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    onSelectNode(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingNodeId) {
      const newX = Math.round((e.clientX - pan.x - dragOffset.x) / zoom / 10) * 10;
      const newY = Math.round((e.clientY - pan.y - dragOffset.y) / zoom / 10) * 10;
      onUpdateNodes(
        nodes.map((n) => (n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n))
      );
    }

    if (connectingSource && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setMousePos({ x: canvasMouseX, y: canvasMouseY });

      // Verificação de Ímã (snap): raio de 100px até qualquer target handle válido
      let closest: SnappedTarget | null = null;
      let minDistance = 100; // 100px conforme especificação

      nodes.forEach((n) => {
        if (n.id === connectingSource.nodeId || n.type === 'trigger_keyword') return;
        const targetX = n.position.x;
        const targetY = n.position.y + 48; // centro vertical do handle de entrada
        const dist = Math.hypot(targetX - canvasMouseX, targetY - canvasMouseY);
        if (dist <= minDistance) {
          minDistance = dist;
          const sourceNode = nodes.find((sn) => sn.id === connectingSource.nodeId);
          closest = {
            nodeId: n.id,
            x: targetX,
            y: targetY,
            portColor: getSourcePortColor(sourceNode, connectingSource.handle),
          };
        }
      });

      setSnappedTarget(closest);
    }
  };

  // Finalização da conexão (ao soltar o mouse ou clicar no handle)
  const commitConnection = (sourceNodeId: string, targetNodeId: string, handle?: string) => {
    if (sourceNodeId === targetNodeId) return;

    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
    const color = getSourcePortColor(sourceNode, handle);
    const newEdgeId = `edge_${Date.now()}`;

    const newEdge: FlowEdge = {
      id: newEdgeId,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: handle,
    };

    const filtered = edges.filter(
      (edge) => !(edge.source === sourceNodeId && edge.sourceHandle === handle)
    );

    onUpdateEdges([...filtered, newEdge]);

    // Dispara animações de impacto: Flash da aresta, Ripple, Barra de luz e Cometas na borda
    setConnectingEffect({
      targetNodeId,
      edgeId: newEdgeId,
      color,
      createdAt: Date.now(),
    });

    setTimeout(() => {
      setConnectingEffect((prev) => (prev?.edgeId === newEdgeId ? null : prev));
    }, 1000);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);

    if (connectingSource && snappedTarget) {
      commitConnection(connectingSource.nodeId, snappedTarget.nodeId, connectingSource.handle);
    }

    setConnectingSource(null);
    setSnappedTarget(null);
  };

  // Início de conexão ao arrastar a partir de uma porta de saída (Source)
  const handleStartConnect = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    setConnectingSource({ nodeId, handle });
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation();
    onSelectNode(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - pan.x - node.position.x * zoom,
      y: e.clientY - pan.y - node.position.y * zoom,
    });
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.4, Math.min(2.0, Number((prev + delta).toFixed(1)))));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Posição exata da porta de saída
  const getSourceHandlePos = (nodeId: string, handle?: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const sx = node.position.x + 260;
    let sy = node.position.y + 48;
    if (handle === 'true') sy = node.position.y + 72;
    if (handle === 'false') sy = node.position.y + 98;
    if (handle?.startsWith('btn_')) {
      const btnIndex = node.data.buttons?.findIndex((b: any) => b.buttonId === handle) ?? 0;
      sy = node.position.y + 78 + btnIndex * 30;
    }
    return { x: sx, y: sy };
  };

  // Curva de Bézier suave com tangentes horizontais estritas
  const calculatePath = (edge: FlowEdge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return '';

    const { x: sx, y: sy } = getSourceHandlePos(edge.source, edge.sourceHandle);
    const tx = targetNode.position.x - 2;
    const ty = targetNode.position.y + 48;

    const dx = tx - sx;
    const dy = ty - sy;

    if (dx >= 40) {
      const controlDist = Math.max(Math.min(dx * 0.45, 180), 60);
      return `M ${sx} ${sy} C ${sx + controlDist} ${sy}, ${tx - controlDist} ${ty}, ${tx} ${ty}`;
    } else {
      const exitDist = Math.max(50, Math.min(Math.abs(dy) * 0.35, 90));
      const entryDist = 60;
      const midX = sx + exitDist;
      const midY = sy + dy * 0.5;
      return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${midY}, ${(sx + tx) / 2} ${midY} S ${tx - entryDist} ${ty}, ${tx} ${ty}`;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full overflow-hidden bg-[#0d1017] cursor-grab active:cursor-grabbing select-none"
    >
      {/* Estilos CSS injetados para as animações precisas da receita */}
      <style>{`
        @keyframes zaptrollRipple {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes zaptrollLightBar {
          0% { height: 4px; opacity: 1; }
          30% { height: 52px; opacity: 1; }
          100% { height: 52px; opacity: 0; }
        }
        @keyframes zaptrollRadialGlow {
          0% { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes zaptrollCometClockwise {
          0% { stroke-dashoffset: 48; opacity: 1; }
          80% { opacity: 1; }
          100% { stroke-dashoffset: -350; opacity: 0; }
        }
        @keyframes zaptrollCometCounterClockwise {
          0% { stroke-dashoffset: 48; opacity: 1; }
          80% { opacity: 1; }
          100% { stroke-dashoffset: 446; opacity: 0; }
        }
        @keyframes zaptrollEdgeFlash {
          0% { stroke-width: 6; stroke-opacity: 1; filter: drop-shadow(0 0 12px currentColor); }
          100% { stroke-width: 2.5; stroke-opacity: 0.9; filter: none; }
        }
        .anim-ripple {
          animation: zaptrollRipple 450ms ease-out forwards;
        }
        .anim-light-bar {
          animation: zaptrollLightBar 250ms ease-out forwards;
        }
        .anim-radial-glow {
          animation: zaptrollRadialGlow 700ms ease-out forwards;
        }
        .anim-comet-cw {
          stroke-dasharray: 46 760;
          animation: zaptrollCometClockwise 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-comet-ccw {
          stroke-dasharray: 46 760;
          animation: zaptrollCometCounterClockwise 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-edge-flash {
          animation: zaptrollEdgeFlash 500ms ease-out forwards;
        }
      `}</style>

      {/* Grid de fundo */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, #39ff14 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Controles flutuantes de Zoom e Layout */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 bg-[#161922]/90 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 shadow-xl">
        <button
          type="button"
          onClick={() => handleZoom(0.1)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          title="Aumentar Zoom"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-gray-400 px-1 min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => handleZoom(-0.1)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          title="Diminuir Zoom"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          type="button"
          onClick={resetView}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          title="Centralizar Visualização"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        {onAutoLayout && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              type="button"
              onClick={onAutoLayout}
              className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all flex items-center gap-1.5"
              title="Organizar nós automaticamente (Auto-Layout)"
            >
              <Workflow className="w-4 h-4" />
              <span className="text-[11px] font-mono font-bold pr-1">Organizar</span>
            </button>
          </>
        )}
      </div>

      {/* Camada Canvas Transformável */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* SVG de Arestas e Raios */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#39ff14" />
            </marker>
          </defs>

          {/* Arestas Estabelecidas (Edges) */}
          {edges.map((edge) => {
            const isConnectedToSelected =
              edge.source === selectedNodeId || edge.target === selectedNodeId;
            const pathData = calculatePath(edge);
            if (!pathData) return null;

            const sourceNode = nodes.find((n) => n.id === edge.source);
            const edgeColor = isConnectedToSelected
              ? '#39ff14'
              : getSourcePortColor(sourceNode, edge.sourceHandle);
            const isFresh = connectingEffect?.edgeId === edge.id;

            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer group">
                {/* Linha da aresta na cor da porta de origem */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth={isConnectedToSelected ? 2.8 : 2}
                  strokeOpacity={isConnectedToSelected ? 1 : 0.85}
                  markerEnd={isConnectedToSelected ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                  className={`transition-colors group-hover:stroke-[#39ff14] ${isFresh ? 'anim-edge-flash' : ''}`}
                />
                {/* Clique expandido na linha para exclusão */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateEdges(edges.filter((ed) => ed.id !== edge.id));
                  }}
                >
                  <title>Clique para remover a conexão</title>
                </path>
              </g>
            );
          })}

          {/* 2 & 3. LINHA NEUTRA ARRASTANDO + ÍMÃ & RAIO ELÉTRICO */}
          {connectingSource && (() => {
            const start = getSourceHandlePos(connectingSource.nodeId, connectingSource.handle);
            const sourceNode = nodes.find((n) => n.id === connectingSource.nodeId);
            const portColor = getSourcePortColor(sourceNode, connectingSource.handle);

            const endX = mousePos.x;
            const endY = mousePos.y;

            const dx = endX - start.x;
            const controlDist = Math.max(Math.min(Math.abs(dx) * 0.45, 140), 40);
            const linePath = `M ${start.x} ${start.y} C ${start.x + controlDist} ${start.y}, ${endX - controlDist} ${endY}, ${endX} ${endY}`;

            return (
              <g className="pointer-events-none">
                {/* Halo da linha neutra: 10px a 15% opacidade */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#F8F9FA"
                  strokeWidth={10}
                  strokeOpacity={0.15}
                  strokeLinecap="round"
                />

                {/* Linha neutra de arraste: 4px, branca no escuro (#F8F9FA) */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#F8F9FA"
                  strokeWidth={4}
                  strokeLinecap="round"
                />

                {/* Ponta da linha: círculo de 11px no cursor com brilho */}
                <circle
                  cx={endX}
                  cy={endY}
                  r={5.5}
                  fill="#F8F9FA"
                  filter="drop-shadow(0 0 6px rgba(248, 249, 250, 0.7))"
                />

                {/* EFEITO ÍMÃ E RAIO (quando a ponta entra no raio de 100px de um handle válido) */}
                {snappedTarget && (() => {
                  const { mainPath, branchPath } = generateLightningPath(
                    endX,
                    endY,
                    snappedTarget.x,
                    snappedTarget.y,
                    lightningTick
                  );
                  return (
                    <g>
                      {/* Brilho e ruído do raio na cor da porta (stroke 5px) */}
                      <path
                        d={mainPath}
                        fill="none"
                        stroke={portColor}
                        strokeWidth={5}
                        strokeOpacity={0.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 8px ${portColor})` }}
                      />
                      {/* Fio branco central de 1.2px */}
                      <path
                        d={mainPath}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Ramo fino secundário a 80% do comprimento */}
                      <path
                        d={branchPath}
                        fill="none"
                        stroke={portColor}
                        strokeWidth={2.5}
                        strokeOpacity={0.7}
                        strokeLinecap="round"
                      />
                      <path
                        d={branchPath}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={1}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })()}
              </g>
            );
          })()}
        </svg>

        {/* Camada de Nós (Cards) */}
        {nodes.map((node) => {
          const config = NODE_COLORS[node.type] || NODE_COLORS.message_text;
          const Icon = config.icon;
          const isSelected = selectedNodeId === node.id;
          const isSimulated = activeSimulatedNodeId === node.id;
          const isSnapped = snappedTarget?.nodeId === node.id;
          const isConnectedEffect = connectingEffect?.targetNodeId === node.id;
          const effectColor = connectingEffect?.color || '#37DC7E';

          return (
            <div
              key={node.id}
              style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              className={`flow-node-card absolute pointer-events-auto w-[260px] rounded-2xl bg-[#161922] border transition-all ${
                isSimulated
                  ? 'border-[#39ff14] shadow-[0_0_30px_rgba(57,255,20,0.6)] ring-2 ring-[#39ff14]'
                  : isSelected
                  ? 'border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                  : isSnapped
                  ? 'border-white/50 shadow-[0_0_25px_rgba(255,255,255,0.2)]'
                  : `${config.border} hover:border-white/30 shadow-xl`
              }`}
            >
              {/* 4. BRILHO INTERNO RADIAL (700 ms ao conectar) */}
              {isConnectedEffect && (
                <div
                  className="anim-radial-glow absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
                  style={{
                    background: `radial-gradient(160px circle at 0px 48px, ${effectColor}55 0%, transparent 80%)`,
                  }}
                />
              )}

              {/* 4. BARRA DE LUZ NA BORDA ESQUERDA (4 a 52px por 250ms) */}
              {isConnectedEffect && (
                <div
                  className="anim-light-bar absolute left-0 top-[22px] w-[3px] rounded-r pointer-events-none"
                  style={{
                    backgroundColor: effectColor,
                    boxShadow: `0 0 10px ${effectColor}, 0 0 20px ${effectColor}`,
                  }}
                />
              )}

              {/* 5. BORDA CORRENDO (2 COMETAS CONTORNANDO O CARD EM SENTIDOS OPOSTOS) */}
              {isConnectedEffect && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible rounded-2xl z-30">
                  {/* Cometa Horário (sai do handle e contorna por cima) */}
                  <rect
                    x="0"
                    y="0"
                    width="260"
                    height="125"
                    rx="16"
                    fill="none"
                    stroke={effectColor}
                    strokeWidth={3}
                    pathLength="760"
                    className="anim-comet-cw"
                    style={{ filter: `drop-shadow(0 0 7px ${effectColor})` }}
                  />
                  {/* Cometa Anti-horário (sai do handle e contorna por baixo) */}
                  <rect
                    x="0"
                    y="0"
                    width="260"
                    height="125"
                    rx="16"
                    fill="none"
                    stroke={effectColor}
                    strokeWidth={3}
                    pathLength="760"
                    className="anim-comet-ccw"
                    style={{ filter: `drop-shadow(0 0 7px ${effectColor})` }}
                  />
                </svg>
              )}

              {/* TARGET HANDLE (Entrada à esquerda: x=0, y=48) */}
              {node.type !== 'trigger_keyword' && (
                <div className="absolute -left-3 top-9 z-20">
                  {/* Ripple animado ao conectar */}
                  {isConnectedEffect && (
                    <div
                      className="anim-ripple absolute inset-0 w-6 h-6 rounded-full pointer-events-none"
                      style={{
                        border: `2px solid ${effectColor}`,
                        boxShadow: `0 0 12px ${effectColor}`,
                      }}
                    />
                  )}

                  <div
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (connectingSource) {
                        commitConnection(connectingSource.nodeId, node.id, connectingSource.handle);
                        setConnectingSource(null);
                        setSnappedTarget(null);
                      }
                    }}
                    className={`flow-handle relative w-6 h-6 rounded-full bg-[#161922] flex items-center justify-center cursor-crosshair transition-all duration-150 ${
                      isSnapped
                        ? 'scale-135 border-2 shadow-lg'
                        : 'border-2 border-gray-400 hover:scale-125'
                    }`}
                    style={{
                      borderColor: isSnapped
                        ? snappedTarget?.portColor
                        : isConnectedEffect
                        ? effectColor
                        : undefined,
                      boxShadow: isSnapped
                        ? `0 0 16px ${snappedTarget?.portColor}`
                        : undefined,
                      transform: isSnapped ? 'scale(1.35)' : undefined,
                    }}
                    title="Entrada: Conecte aqui"
                  >
                    {/* Miolo claro com anel na cor da porta */}
                    <div
                      className="w-2.5 h-2.5 rounded-full transition-colors"
                      style={{
                        backgroundColor: isSnapped ? '#ffffff' : '#e2e8f0',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Node Header */}
              <div
                className={`p-3 rounded-t-2xl flex items-center justify-between ${config.bg} border-b border-white/5 relative z-10`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className={`p-1.5 rounded-lg bg-black/40 ${config.text}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400 block">
                      {node.type.replace('_', ' ')}
                    </span>
                    <h3 className="text-xs font-bold text-white truncate max-w-[150px]">
                      {node.name || 'Sem título'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateNode(node);
                    }}
                    className="p-1 hover:text-white text-gray-400 rounded transition-all"
                    title="Duplicar Nó"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    className="p-1 hover:text-red-400 text-gray-400 rounded transition-all"
                    title="Excluir Nó"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Node Body Content Preview */}
              <div className="p-3 text-xs text-gray-300 space-y-1.5 relative z-10">
                {node.type === 'trigger_keyword' && (
                  <div className="flex flex-wrap gap-1">
                    {(node.data.keywords || ['/inicio']).map((kw: string) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[10px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {node.type === 'message_text' && (
                  <p className="line-clamp-2 text-gray-300 text-[11px] leading-relaxed">
                    {node.data.text || 'Digite a mensagem de resposta...'}
                  </p>
                )}

                {node.type === 'interactive_buttons' && (
                  <div className="space-y-1">
                    <p className="line-clamp-1 text-[11px] text-gray-400">{node.data.content || 'Escolha uma opção:'}</p>
                    <div className="space-y-1 mt-1">
                      {(node.data.buttons || [{ buttonId: 'btn_1', displayText: 'Opção 1' }]).map(
                        (b: any) => (
                          <div
                            key={b.buttonId}
                            className="relative flex items-center justify-between px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-blue-300 font-mono"
                          >
                            <span className="truncate max-w-[170px]">{b.displayText}</span>
                            {/* Button individual output handle */}
                            <div
                              onMouseDown={(e) => handleStartConnect(e, node.id, b.buttonId)}
                              className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-blue-400 hover:bg-blue-400 flex items-center justify-center cursor-crosshair z-20 hover:scale-125 transition-transform"
                              style={{ boxShadow: '0 0 8px rgba(68,122,247,0.4)' }}
                              title={`Saída: ${b.displayText}`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {node.type === 'hosted_page_button' && (
                  <div className="p-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px]">
                    <span className="font-bold text-indigo-300 block truncate">
                      🔗 {node.data.buttonText || 'Abrir Formulário'}
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {node.data.schema?.title || 'Formulário Seguro ZapTroll'}
                    </span>
                  </div>
                )}

                {node.type === 'data_capture' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono">
                    <span>Salva em:</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 font-bold">
                      ${`{${node.data.variableName || 'resposta'}}`}
                    </span>
                  </div>
                )}

                {node.type === 'condition' && (
                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between items-center text-emerald-400">
                      <span>✓ SIM / VERDADEIRO</span>
                      <div
                        onMouseDown={(e) => handleStartConnect(e, node.id, 'true')}
                        className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-[#37DC7E] hover:bg-[#37DC7E] flex items-center justify-center cursor-crosshair z-20 hover:scale-125 transition-transform"
                        style={{ boxShadow: '0 0 8px rgba(55,220,126,0.4)' }}
                        title="Saída Verdadeiro (SIM)"
                      />
                    </div>
                    <div className="flex justify-between items-center text-rose-400">
                      <span>✕ NÃO / FALSO</span>
                      <div
                        onMouseDown={(e) => handleStartConnect(e, node.id, 'false')}
                        className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-[#EF5050] hover:bg-[#EF5050] flex items-center justify-center cursor-crosshair z-20 hover:scale-125 transition-transform"
                        style={{ boxShadow: '0 0 8px rgba(239,80,80,0.4)' }}
                        title="Saída Falso (NÃO)"
                      />
                    </div>
                  </div>
                )}

                {node.type === 'pix_charge' && (
                  <div className="flex items-center justify-between text-[11px] font-mono text-lime-300">
                    <span>Cobrança:</span>
                    <span className="font-bold">R$ {node.data.amount || '0,00'}</span>
                  </div>
                )}

                {node.type === 'http_request' && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono truncate text-teal-300">
                    <span className="font-bold">{node.data.method || 'POST'}</span>
                    <span className="text-gray-400 truncate">{node.data.url || 'https://api...'}</span>
                  </div>
                )}

                {node.type === 'game_launcher' && (
                  <div className="p-1.5 rounded-lg bg-rose-950/30 border border-rose-500/20 text-[10px] text-rose-300 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span className="font-bold">{node.data.gameTitle || 'DOOM Retrô Arcade'}</span>
                  </div>
                )}
              </div>

              {/* SOURCE HANDLE PADRÃO (Saída à direita: x=260, y=48) */}
              {!['interactive_buttons', 'condition', 'end_flow'].includes(node.type) && (
                <div
                  onMouseDown={(e) => handleStartConnect(e, node.id)}
                  className={`flow-handle absolute -right-3 top-9 w-6 h-6 rounded-full bg-[#161922] border-2 flex items-center justify-center cursor-crosshair z-20 transition-all duration-150 hover:scale-125 ${
                    connectingSource?.nodeId === node.id
                      ? 'border-[#F8F9FA] ring-2 ring-white/50 scale-125'
                      : 'border-gray-400 hover:border-[#37DC7E]'
                  }`}
                  style={{
                    borderColor: connectingSource?.nodeId === node.id
                      ? '#F8F9FA'
                      : getSourcePortColor(node),
                    boxShadow: `0 0 10px ${getSourcePortColor(node)}66`,
                  }}
                  title="Saída: Arraste para conectar ao próximo nó"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: connectingSource?.nodeId === node.id ? '#ffffff' : getSourcePortColor(node),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
