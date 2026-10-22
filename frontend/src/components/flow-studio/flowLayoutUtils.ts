import { FlowNode, FlowEdge } from '../../types/flows.js';

/**
 * Intelligent DAG / Tree layout engine for Zaptroll Flow Studio.
 * Automatically aligns nodes in clean columns and parallel branch tracks,
 * preventing overlapping cards and tangled crossing lines.
 */
export function autoLayoutFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (!nodes || nodes.length <= 1) return nodes;

  const CARD_WIDTH = 260;
  const COL_GAP = 120; // 380px column pitch
  const ROW_GAP = 180; // vertical separation between parallel branches
  const BASE_X = 60;
  const BASE_Y = 100;

  // 1. Build graph adjacency
  const outgoing = new Map<string, Array<{ target: string; handle?: string }>>();
  const incoming = new Map<string, string[]>();

  nodes.forEach((n) => {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  });

  edges.forEach((e) => {
    outgoing.get(e.source)?.push({ target: e.target, handle: e.sourceHandle });
    incoming.get(e.target)?.push(e.source);
  });

  // 2. Identify root / entry nodes (prefer trigger_keyword or nodes with 0 incoming edges)
  let roots = nodes.filter((n) => (incoming.get(n.id)?.length || 0) === 0);
  if (roots.length === 0) {
    const trigger = nodes.find((n) => n.type === 'trigger_keyword');
    roots = trigger ? [trigger] : [nodes[0]];
  }

  // Ensure triggers are prioritized at column 0
  roots.sort((a, b) => (a.type === 'trigger_keyword' ? -1 : 1));

  // 3. Compute column levels (depth in graph)
  const nodeLevels = new Map<string, number>();
  const visited = new Set<string>();

  const queue: Array<{ id: string; level: number }> = roots.map((r) => ({ id: r.id, level: 0 }));
  roots.forEach((r) => nodeLevels.set(r.id, 0));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    visited.add(id);

    const children = outgoing.get(id) || [];
    children.forEach((child) => {
      const currentLevel = nodeLevels.get(child.target) ?? 0;
      const nextLevel = Math.max(currentLevel, level + 1);
      nodeLevels.set(child.target, nextLevel);

      if (!visited.has(child.target) || nextLevel > currentLevel) {
        queue.push({ id: child.target, level: nextLevel });
      }
    });
  }

  // Handle any disconnected floating nodes
  let maxAssignedLevel = 0;
  nodeLevels.forEach((lvl) => {
    if (lvl > maxAssignedLevel) maxAssignedLevel = lvl;
  });

  nodes.forEach((n) => {
    if (!nodeLevels.has(n.id)) {
      nodeLevels.set(n.id, 0);
    }
  });

  // 4. Group nodes by column level
  const columns = new Map<number, FlowNode[]>();
  nodes.forEach((n) => {
    const lvl = nodeLevels.get(n.id) || 0;
    if (!columns.has(lvl)) columns.set(lvl, []);
    columns.get(lvl)!.push(n);
  });

  // 5. Calculate clean Y coordinates and branch track assignments
  const sortedColKeys = Array.from(columns.keys()).sort((a, b) => a - b);
  const assignedPositions = new Map<string, { x: number; y: number }>();
  const nodeTrack = new Map<string, number>();

  sortedColKeys.forEach((lvl) => {
    const colNodes = columns.get(lvl)!;
    const colX = BASE_X + lvl * (CARD_WIDTH + COL_GAP);

    if (lvl === 0) {
      colNodes.forEach((node, idx) => {
        const y = BASE_Y + idx * ROW_GAP;
        assignedPositions.set(node.id, { x: colX, y });
        nodeTrack.set(node.id, idx);
      });
      return;
    }

    // Sort column nodes based on the track and handle order of their parents
    colNodes.sort((a, b) => {
      const parentsA = incoming.get(a.id) || [];
      const parentsB = incoming.get(b.id) || [];

      // Check if parents are conditional or buttons
      const getParentOrder = (nodeId: string): number => {
        const pIds = incoming.get(nodeId) || [];
        if (pIds.length === 0) return 0;
        const pId = pIds[0];
        const pTrack = nodeTrack.get(pId) ?? 0;
        
        // Find which handle connected to this node
        const edge = edges.find((e) => e.source === pId && e.target === nodeId);
        let handleBonus = 0;
        if (edge?.sourceHandle === 'false') handleBonus = 1;
        if (edge?.sourceHandle?.startsWith('btn_')) {
          const btnIdx = parseInt(edge.sourceHandle.replace('btn_', ''), 10) || 0;
          handleBonus = btnIdx;
        }
        return pTrack * 10 + handleBonus;
      };

      return getParentOrder(a.id) - getParentOrder(b.id);
    });

    // Assign tracks & positions
    if (colNodes.length === 1) {
      const singleNode = colNodes[0];
      const parents = incoming.get(singleNode.id) || [];
      
      let targetY = BASE_Y;
      if (parents.length === 1) {
        const parentPos = assignedPositions.get(parents[0]);
        if (parentPos) {
          // If parent has multiple children, offset accordingly
          const siblings = outgoing.get(parents[0]) || [];
          if (siblings.length > 1) {
            const siblingIndex = siblings.findIndex((s) => s.target === singleNode.id);
            const offset = (siblingIndex - (siblings.length - 1) / 2) * ROW_GAP;
            targetY = parentPos.y + offset;
          } else {
            targetY = parentPos.y;
          }
        }
      } else if (parents.length > 1) {
        // Convergent node (e.g. End or Delay merging multiple branches): Center between parents!
        const parentYs = parents
          .map((pId) => assignedPositions.get(pId)?.y)
          .filter((y): y is number => y !== undefined);
        if (parentYs.length > 0) {
          targetY = parentYs.reduce((sum, y) => sum + y, 0) / parentYs.length;
        }
      }

      assignedPositions.set(singleNode.id, { x: colX, y: targetY });
      nodeTrack.set(singleNode.id, Math.round(targetY / ROW_GAP));
    } else {
      // Multiple nodes branching in the same column
      // Distribute them symmetrically around parent or vertically spaced
      const totalHeight = (colNodes.length - 1) * ROW_GAP;
      const startY = Math.max(40, BASE_Y - totalHeight / 2);

      colNodes.forEach((node, idx) => {
        const y = startY + idx * ROW_GAP;
        assignedPositions.set(node.id, { x: colX, y });
        nodeTrack.set(node.id, idx);
      });
    }
  });

  // 6. Collision Resolution: ensure no two nodes overlap in 2D space
  const finalNodes = nodes.map((node) => {
    const pos = assignedPositions.get(node.id) || node.position;
    return {
      ...node,
      position: {
        x: Math.round(pos.x / 10) * 10,
        y: Math.round(pos.y / 10) * 10,
      },
    };
  });

  // Sort and nudge apart any same-column overlaps
  sortedColKeys.forEach((lvl) => {
    const colNodes = finalNodes.filter((n) => (nodeLevels.get(n.id) || 0) === lvl);
    colNodes.sort((a, b) => a.position.y - b.position.y);

    for (let i = 1; i < colNodes.length; i++) {
      const prev = colNodes[i - 1];
      const curr = colNodes[i];
      if (curr.position.y - prev.position.y < 150) {
        curr.position.y = prev.position.y + 160;
      }
    }
  });

  return finalNodes;
}
