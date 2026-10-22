export type FlowNodeType =
  | 'trigger_keyword'
  | 'message_text'
  | 'message_media'
  | 'interactive_buttons'
  | 'hosted_page_button'
  | 'data_capture'
  | 'condition'
  | 'wait_delay'
  | 'http_request'
  | 'pix_charge'
  | 'game_launcher'
  | 'end_flow';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  defaultValue?: any;
  description?: string;
}

export interface Flow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  currentVersion: number;
  triggerKeywords: string[];
  connectionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  isPublished: boolean;
  publishedAt?: string;
}

export interface FlowExecutionEvent {
  id: string;
  sessionId: string;
  nodeId: string;
  eventType: 'node_start' | 'node_complete' | 'message_sent' | 'input_received' | 'error';
  payload: any;
  timestamp: string;
}

export interface FlowSession {
  id: string;
  flowId: string;
  flowVersionId: string;
  connectionId: string;
  userJid: string;
  currentNodeId: string;
  status: 'active' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  variables: Record<string, any>;
  stepHistory: Array<{ nodeId: string; timestamp: string }>;
  waitingFor?: {
    type: string;
    nodeId: string;
    validOptions?: string[];
  } | null;
  lastInteractionAt: string;
}

export interface FlowTemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  nodesCount: number;
  tags: string[];
}
