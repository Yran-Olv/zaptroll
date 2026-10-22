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

// Legacy Aliases for backward compatibility
export type LegacyFlowNodeType =
  | 'logic_condition'
  | 'integration_http'
  | 'commercial_pix_payment'
  | 'logic_end'
  | `capture_${string}`;

export interface FlowNode {
  id: string;
  type: FlowNodeType | LegacyFlowNodeType;
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

export interface FlowTemplateDefinition {
  id: string;
  name: string;
  category: 'onboarding' | 'commercial' | 'forms' | 'games' | 'rpg';
  description: string;
  triggerKeywords: string[];
  tags: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: FlowVariable[];
}
