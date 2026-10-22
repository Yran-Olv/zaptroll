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
  Plus,
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
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setConnectingSource(null);
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

  // Handle connection start from output
  const handleStartConnect = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    setConnectingSource({ nodeId, handle });
  };

  // Handle connection end on input
  const handleEndConnect = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (connectingSource && connectingSource.nodeId !== targetNodeId) {
      // Create new edge or replace if same sourceHandle exists
      const newEdge: FlowEdge = {
        id: `edge_${Date.now()}`,
        source: connectingSource.nodeId,
        target: targetNodeId,
        sourceHandle: connectingSource.handle,
      };

      const filtered = edges.filter(
        (edge) =>
          !(
            edge.source === connectingSource.nodeId &&
            edge.sourceHandle === connectingSource.handle
          )
      );

      onUpdateEdges([...filtered, newEdge]);
      setConnectingSource(null);
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.4, Math.min(2.0, Number((prev + delta).toFixed(1)))));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Calculate Bezier path between nodes
  const calculatePath = (edge: FlowEdge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return '';

    const nodeWidth = 260;
    const nodeHeight = 120;

    let sx = sourceNode.position.x + nodeWidth;
    let sy = sourceNode.position.y + 40;

    // Adjust source port Y if handle is conditional or button
    if (edge.sourceHandle === 'true') sy = sourceNode.position.y + 60;
    if (edge.sourceHandle === 'false') sy = sourceNode.position.y + 90;
    if (edge.sourceHandle?.startsWith('btn_')) {
      const btnIndex = sourceNode.data.buttons?.findIndex((b: any) => b.buttonId === edge.sourceHandle) ?? 0;
      sy = sourceNode.position.y + 65 + btnIndex * 26;
    }

    const tx = targetNode.position.x;
    const ty = targetNode.position.y + 40;

    const dx = Math.abs(tx - sx) * 0.5;
    return `M ${sx} ${sy} C ${sx + Math.max(dx, 40)} ${sy}, ${tx - Math.max(dx, 40)} ${ty}, ${tx} ${ty}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full overflow-hidden bg-[#0d1017] cursor-grab active:cursor-grabbing select-none"
    >
      {/* Canvas Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, #39ff14 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Floating Canvas Controls */}
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
      </div>

      {/* Transformable Canvas Layer */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* SVG Edges and Connectors */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#4b5563" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#39ff14" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const isConnectedToSelected =
              edge.source === selectedNodeId || edge.target === selectedNodeId;
            const pathData = calculatePath(edge);
            if (!pathData) return null;

            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer group">
                <path
                  d={pathData}
                  fill="none"
                  stroke={isConnectedToSelected ? '#39ff14' : '#374151'}
                  strokeWidth={isConnectedToSelected ? 2.5 : 2}
                  markerEnd={isConnectedToSelected ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                  className="transition-colors group-hover:stroke-[#39ff14]"
                />
                {/* Delete Edge Button on hover */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateEdges(edges.filter((ed) => ed.id !== edge.id));
                  }}
                >
                  <title>Clique na linha para remover a conexão</title>
                </path>
              </g>
            );
          })}

          {/* Dynamic connecting drag line */}
          {connectingSource && (
            <path
              d={`M ${
                (nodes.find((n) => n.id === connectingSource.nodeId)?.position.x || 0) + 260
              } ${
                (nodes.find((n) => n.id === connectingSource.nodeId)?.position.y || 0) + 40
              } L ${mousePos.x} ${mousePos.y}`}
              fill="none"
              stroke="#39ff14"
              strokeWidth={2}
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Nodes Layer */}
        {nodes.map((node) => {
          const config = NODE_COLORS[node.type] || NODE_COLORS.message_text;
          const Icon = config.icon;
          const isSelected = selectedNodeId === node.id;
          const isSimulated = activeSimulatedNodeId === node.id;

          return (
            <div
              key={node.id}
              style={{
                transform: `translate(${node.position.x}px, ${node.position.y}px)`,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              className={`flow-node-card absolute pointer-events-auto w-[260px] rounded-2xl bg-[#161922] border transition-shadow ${
                isSimulated
                  ? 'border-[#39ff14] shadow-[0_0_30px_rgba(57,255,20,0.6)] ring-2 ring-[#39ff14]'
                  : isSelected
                  ? 'border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                  : `${config.border} hover:border-white/30 shadow-xl`
              }`}
            >
              {/* Target / Input Port Handle */}
              {node.type !== 'trigger_keyword' && (
                <div
                  onMouseUp={(e) => handleEndConnect(e, node.id)}
                  className="flow-handle absolute -left-3 top-9 w-6 h-6 rounded-full bg-[#161922] border-2 border-gray-400 hover:border-[#39ff14] hover:bg-[#39ff14]/20 flex items-center justify-center cursor-crosshair z-10 transition-transform hover:scale-125"
                  title="Entrada: Conecte aqui"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                </div>
              )}

              {/* Node Header */}
              <div
                className={`p-3 rounded-t-2xl flex items-center justify-between ${config.bg} border-b border-white/5`}
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
              <div className="p-3 text-xs text-gray-300 space-y-1.5">
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
                              className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-blue-400 hover:bg-blue-400 flex items-center justify-center cursor-crosshair z-10"
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
                        className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-emerald-400 hover:bg-emerald-400 flex items-center justify-center cursor-crosshair"
                      />
                    </div>
                    <div className="flex justify-between items-center text-rose-400">
                      <span>✕ NÃO / FALSO</span>
                      <div
                        onMouseDown={(e) => handleStartConnect(e, node.id, 'false')}
                        className="flow-handle -mr-4 w-5 h-5 rounded-full bg-[#161922] border-2 border-rose-400 hover:bg-rose-400 flex items-center justify-center cursor-crosshair"
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

              {/* Default Output Port Handle (for nodes without custom outputs) */}
              {!['interactive_buttons', 'condition', 'end_flow'].includes(node.type) && (
                <div
                  onMouseDown={(e) => handleStartConnect(e, node.id)}
                  className="flow-handle absolute -right-3 top-9 w-6 h-6 rounded-full bg-[#161922] border-2 border-gray-400 hover:border-[#39ff14] hover:bg-[#39ff14]/20 flex items-center justify-center cursor-crosshair z-10 transition-transform hover:scale-125"
                  title="Saída: Arraste para conectar ao próximo nó"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
