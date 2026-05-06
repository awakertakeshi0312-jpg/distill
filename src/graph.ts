import type { Project, ThoughtBlock } from './model';
import type { PersonMention } from './repository';

export type GraphNodeKind = 'block' | 'project' | 'person' | 'concept';
export type GraphEdgeType = 'all' | 'project' | 'person' | 'concept';

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  blockId?: string;
};

export type PositionedGraphNode = GraphNode & {
  x: number;
  y: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  edgeType?: Exclude<GraphEdgeType, 'all'> | string;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  positionedNodes: PositionedGraphNode[];
  positionById: Map<string, PositionedGraphNode>;
};

export type GraphNeighbor = {
  node: GraphNode;
  edge: GraphEdge;
  direction: 'source' | 'target';
};

type ProjectWithBlockCount = Project & {
  blocks: number;
};

function shortLabel(content: string) {
  return content.length > 34 ? `${content.slice(0, 34)}...` : content;
}

export function layoutKnowledgeGraph(snapshot: GraphSnapshot): KnowledgeGraph {
  const positionedNodes = snapshot.nodes.map((node, index) => {
    const radius = node.kind === 'block' ? 150 : 220;
    const angle = (index / Math.max(snapshot.nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      ...node,
      x: 300 + Math.cos(angle) * radius,
      y: 250 + Math.sin(angle) * radius,
    };
  });
  const positionById = new Map(positionedNodes.map((node) => [node.id, node]));

  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    positionedNodes,
    positionById,
  };
}

export function buildKnowledgeGraph(
  activeBlocks: ThoughtBlock[],
  projectCounts: ProjectWithBlockCount[],
  peopleIndex: PersonMention[],
): KnowledgeGraph {
  const nodes: GraphNode[] = [
    ...activeBlocks.slice(0, 12).map((block) => ({
      id: block.id,
      label: shortLabel(block.content),
      kind: 'block' as const,
      blockId: block.id,
    })),
    ...projectCounts
      .filter((project) => project.blocks > 0)
      .map((project) => ({
        id: project.id,
        label: project.name,
        kind: 'project' as const,
      })),
    ...peopleIndex.slice(0, 8).map((person) => ({
      id: `person:${person.name}`,
      label: `@${person.name}`,
      kind: 'person' as const,
      blockId: person.blockIds[0],
    })),
    ...Array.from(new Set(activeBlocks.flatMap((block) => block.links)))
      .slice(0, 12)
      .map((link) => ({
        id: `concept:${link}`,
        label: link,
        kind: 'concept' as const,
      })),
  ];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = [
    ...activeBlocks
      .filter((block) => block.projectId && nodeIds.has(block.id) && nodeIds.has(block.projectId))
      .map((block) => ({
        source: block.id,
        target: block.projectId as string,
        edgeType: 'project' as const,
      })),
    ...activeBlocks.flatMap((block) =>
      block.links
        .map((link) => ({
          source: block.id,
          target: `concept:${link}`,
          edgeType: 'concept' as const,
        }))
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    ),
    ...peopleIndex.flatMap((person) =>
      person.blockIds
        .map((blockId) => ({
          source: blockId,
          target: `person:${person.name}`,
          edgeType: 'person' as const,
        }))
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    ),
  ];

  return layoutKnowledgeGraph({ nodes, edges });
}

export function filterKnowledgeGraph(graph: KnowledgeGraph, edgeType: GraphEdgeType): KnowledgeGraph {
  if (edgeType === 'all') {
    return graph;
  }

  const edges = graph.edges.filter((edge) => edge.edgeType === edgeType);
  const connectedNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = graph.nodes.filter((node) => connectedNodeIds.has(node.id));

  return layoutKnowledgeGraph({ nodes, edges });
}

export function getGraphNeighbors(graph: KnowledgeGraph, nodeId?: string): GraphNeighbor[] {
  if (!nodeId) {
    return [];
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return graph.edges
    .map((edge) => {
      if (edge.source === nodeId) {
        const node = nodeById.get(edge.target);
        return node ? { node, edge, direction: 'target' as const } : null;
      }

      if (edge.target === nodeId) {
        const node = nodeById.get(edge.source);
        return node ? { node, edge, direction: 'source' as const } : null;
      }

      return null;
    })
    .filter((neighbor): neighbor is GraphNeighbor => neighbor !== null);
}
