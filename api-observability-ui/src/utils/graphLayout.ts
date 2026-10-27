import type { Span } from '../types';

export interface LayoutNode {
  id: string;
  span: Span;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  childIds: string[];
  parentId: string | null;
  durationMs: number;
  durationPct: number;
  isError: boolean;
  isSlowest: boolean;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  isError: boolean;
}

export interface GraphLayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  nodeMap: Map<string, LayoutNode>;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 84;
const HORIZONTAL_GAP = 95;
const VERTICAL_GAP = 36;

/**
 * Calculates non-overlapping graph layout for both Horizontal (Left-to-Right DAG)
 * and Vertical (Top-to-Bottom DAG) trees.
 * Also supports sequential pipeline fallback.
 */
export function calculateGraphLayout(
  spans: Span[],
  totalTraceDuration: number,
  mode: 'horizontal' | 'vertical' | 'pipeline' = 'horizontal'
): GraphLayoutResult {
  if (!spans || spans.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 },
      nodeMap: new Map(),
    };
  }

  // Find slowest span for bottleneck highlight
  let maxDuration = 0;
  let slowestSpanId = '';
  spans.forEach((s) => {
    const id = (s as any).spanId || (s as any).id;
    if (s.durationMs > maxDuration) {
      maxDuration = s.durationMs;
      slowestSpanId = id;
    }
  });

  // Map spans by ID and identify parent-child relationships
  const spanById = new Map<string, Span>();
  const childrenMap = new Map<string, string[]>();
  const allIds = new Set<string>();

  spans.forEach((s) => {
    const id = (s as any).spanId || (s as any).id;
    spanById.set(id, s);
    allIds.add(id);
    if (!childrenMap.has(id)) {
      childrenMap.set(id, []);
    }
  });

  // Identify root spans
  const rootIds: string[] = [];
  spans.forEach((s) => {
    const id = (s as any).spanId || (s as any).id;
    const parentId = s.parentSpanId || null;
    if (parentId && allIds.has(parentId)) {
      const list = childrenMap.get(parentId) || [];
      list.push(id);
      childrenMap.set(parentId, list);
    } else {
      rootIds.push(id);
    }
  });

  if (rootIds.length === 0 && spans.length > 0) {
    const firstId = (spans[0] as any).spanId || (spans[0] as any).id;
    rootIds.push(firstId);
  }

  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  // =========================================================================
  // CASE 1: HORIZONTAL TREE (Left-to-Right DAG)
  // Columns by depth: parents centered vertically between children
  // =========================================================================
  if (mode === 'horizontal') {
    let currentY = 50;

    function positionSubtreeHorizontal(nodeId: string, depth: number): number {
      const span = spanById.get(nodeId);
      if (!span) return currentY;

      const children = childrenMap.get(nodeId) || [];
      let nodeY: number;

      if (children.length === 0) {
        nodeY = currentY;
        currentY += NODE_HEIGHT + VERTICAL_GAP;
      } else {
        const childYPositions = children.map((cid) => positionSubtreeHorizontal(cid, depth + 1));
        const minY = childYPositions[0];
        const maxY = childYPositions[childYPositions.length - 1];
        nodeY = (minY + maxY) / 2;
      }

      const durationPct =
        totalTraceDuration > 0
          ? Math.min(100, Math.max(1, (span.durationMs / totalTraceDuration) * 100))
          : 100;
      const isError = span.status === 'ERROR' || Boolean((span as any).error);

      const layoutNode: LayoutNode = {
        id: nodeId,
        span,
        x: 50 + depth * (NODE_WIDTH + HORIZONTAL_GAP),
        y: nodeY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        depth,
        childIds: children,
        parentId: span.parentSpanId || null,
        durationMs: span.durationMs,
        durationPct,
        isError,
        isSlowest: nodeId === slowestSpanId && maxDuration > 1,
      };

      layoutNodes.push(layoutNode);
      nodeMap.set(nodeId, layoutNode);
      return nodeY;
    }

    rootIds.forEach((rootId) => {
      positionSubtreeHorizontal(rootId, 0);
    });
  }
  // =========================================================================
  // CASE 2: VERTICAL TREE (Top-to-Bottom DAG)
  // Rows by depth: parents centered horizontally above children
  // =========================================================================
  else if (mode === 'vertical') {
    let currentX = 50;

    function positionSubtreeVertical(nodeId: string, depth: number): number {
      const span = spanById.get(nodeId);
      if (!span) return currentX;

      const children = childrenMap.get(nodeId) || [];
      let nodeX: number;

      if (children.length === 0) {
        nodeX = currentX;
        currentX += NODE_WIDTH + 50;
      } else {
        const childXPositions = children.map((cid) => positionSubtreeVertical(cid, depth + 1));
        const minX = childXPositions[0];
        const maxX = childXPositions[childXPositions.length - 1];
        nodeX = (minX + maxX) / 2;
      }

      const durationPct =
        totalTraceDuration > 0
          ? Math.min(100, Math.max(1, (span.durationMs / totalTraceDuration) * 100))
          : 100;
      const isError = span.status === 'ERROR' || Boolean((span as any).error);

      const layoutNode: LayoutNode = {
        id: nodeId,
        span,
        x: nodeX,
        y: 60 + depth * (NODE_HEIGHT + 60),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        depth,
        childIds: children,
        parentId: span.parentSpanId || null,
        durationMs: span.durationMs,
        durationPct,
        isError,
        isSlowest: nodeId === slowestSpanId && maxDuration > 1,
      };

      layoutNodes.push(layoutNode);
      nodeMap.set(nodeId, layoutNode);
      return nodeX;
    }

    rootIds.forEach((rootId) => {
      positionSubtreeVertical(rootId, 0);
    });
  }
  // =========================================================================
  // CASE 3: SEQUENTIAL PIPELINE (Single horizontal chain from 0 to N-1)
  // =========================================================================
  else {
    spans.forEach((span, idx) => {
      const id = (span as any).spanId || (span as any).id;
      const durationPct =
        totalTraceDuration > 0
          ? Math.min(100, Math.max(1, (span.durationMs / totalTraceDuration) * 100))
          : 100;
      const isError = span.status === 'ERROR' || Boolean((span as any).error);

      const layoutNode: LayoutNode = {
        id,
        span,
        x: 50 + idx * (NODE_WIDTH + 65),
        y: 80,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        depth: span.depth || 0,
        childIds: idx < spans.length - 1 ? [(spans[idx + 1] as any).spanId || (spans[idx + 1] as any).id] : [],
        parentId: idx > 0 ? (spans[idx - 1] as any).spanId || (spans[idx - 1] as any).id : null,
        durationMs: span.durationMs,
        durationPct,
        isError,
        isSlowest: id === slowestSpanId && maxDuration > 1,
      };

      layoutNodes.push(layoutNode);
      nodeMap.set(id, layoutNode);
    });
  }

  // =========================================================================
  // BUILD EDGES (Parent -> Child with smooth curves)
  // =========================================================================
  const edges: LayoutEdge[] = [];

  if (mode === 'pipeline') {
    // Sequential edges: Node i -> Node i+1
    for (let i = 0; i < layoutNodes.length - 1; i++) {
      const nodeA = layoutNodes[i];
      const nodeB = layoutNodes[i + 1];
      const startX = nodeA.x + nodeA.width;
      const startY = nodeA.y + nodeA.height / 2;
      const endX = nodeB.x;
      const endY = nodeB.y + nodeB.height / 2;
      const path = `M ${startX} ${startY} L ${endX} ${endY}`;

      edges.push({
        id: `edge-${nodeA.id}-${nodeB.id}`,
        sourceId: nodeA.id,
        targetId: nodeB.id,
        startX,
        startY,
        endX,
        endY,
        path,
        isError: nodeB.isError,
      });
    }
  } else if (mode === 'vertical') {
    // Top-to-Bottom tree edges: Parent bottom -> Child top with vertical stubs
    layoutNodes.forEach((node) => {
      node.childIds.forEach((childId) => {
        const childNode = nodeMap.get(childId);
        if (childNode) {
          const startX = node.x + node.width / 2;
          const startY = node.y + node.height;
          const endX = childNode.x + childNode.width / 2;
          const endY = childNode.y;
          const gapY = endY - startY;
          const stub = gapY > 30 ? Math.min(24, Math.max(12, gapY * 0.25)) : 10;
          const fromY = startY + stub;
          const toY = endY - stub;
          const dy = toY - fromY;
          const c1y = fromY + dy * 0.5;
          const c2y = fromY + dy * 0.5;
          const path = `M ${startX} ${startY} L ${startX} ${fromY} C ${startX} ${c1y}, ${endX} ${c2y}, ${endX} ${toY} L ${endX} ${endY}`;

          edges.push({
            id: `edge-${node.id}-${childNode.id}`,
            sourceId: node.id,
            targetId: childNode.id,
            startX,
            startY,
            endX,
            endY,
            path,
            isError: childNode.isError,
          });
        }
      });
    });
  } else {
    // Left-to-Right tree edges: Parent right -> Child left with horizontal stubs
    layoutNodes.forEach((node) => {
      node.childIds.forEach((childId) => {
        const childNode = nodeMap.get(childId);
        if (childNode) {
          const startX = node.x + node.width;
          const startY = node.y + node.height / 2;
          const endX = childNode.x;
          const endY = childNode.y + childNode.height / 2;
          const gapX = endX - startX;
          const stub = gapX > 30 ? Math.min(24, Math.max(12, gapX * 0.25)) : 10;
          const fromX = startX + stub;
          const toX = endX - stub;
          const dx = toX - fromX;
          const c1x = fromX + dx * 0.5;
          const c2x = fromX + dx * 0.5;
          const path = `M ${startX} ${startY} L ${fromX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${toX} ${endY} L ${endX} ${endY}`;

          edges.push({
            id: `edge-${node.id}-${childNode.id}`,
            sourceId: node.id,
            targetId: childNode.id,
            startX,
            startY,
            endX,
            endY,
            path,
            isError: childNode.isError,
          });
        }
      });
    });
  }

  // Calculate canvas bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  layoutNodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  if (layoutNodes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  const padding = 60;
  return {
    nodes: layoutNodes,
    edges,
    bounds: {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: Math.max(600, maxX - minX + padding * 2),
      height: Math.max(400, maxY - minY + padding * 2),
    },
    nodeMap,
  };
}
