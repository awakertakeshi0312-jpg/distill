import type { GraphEdge, GraphEdgeType, GraphNeighbor, GraphNode, PositionedGraphNode } from '../graph';
import type { UiCopy } from '../i18n';
import { HelpNote } from './HelpNote';

type GraphPanelProps = {
  ui: UiCopy;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  positionedGraphNodes: PositionedGraphNode[];
  graphPositionById: Map<string, PositionedGraphNode>;
  edgeFilter: GraphEdgeType;
  onEdgeFilterChange: (edgeFilter: GraphEdgeType) => void;
  selectedGraphNodeId?: string;
  graphNeighbors: GraphNeighbor[];
  selectedBlockId?: string;
  onSelectGraphNode: (nodeId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onSearchConcept: (concept: string) => void;
};

export function GraphPanel({
  ui,
  graphNodes,
  graphEdges,
  positionedGraphNodes,
  graphPositionById,
  edgeFilter,
  onEdgeFilterChange,
  selectedGraphNodeId,
  graphNeighbors,
  selectedBlockId,
  onSelectGraphNode,
  onSelectBlock,
  onSearchConcept,
}: GraphPanelProps) {
  return (
    <section className="panel graphPanel" id="graph">
      <div className="panelHeader">
        <div>
          <p>{ui.navGraph as string}</p>
          <h2>{ui.graphView as string}</h2>
        </div>
        <div className="panelHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.graph} />
          <span className="countBadge">{ui.graphDetail(graphNodes.length, graphEdges.length)}</span>
        </div>
      </div>

      <div className="graphToolbar">
        <span>{ui.graphFilterLabel as string}</span>
        <div className="graphFilterGroup" role="group" aria-label={ui.graphFilterLabel as string}>
          {(Object.entries(ui.graphFilters) as Array<[GraphEdgeType, string]>).map(([filter, label]) => (
            <button
              className={edgeFilter === filter ? 'active' : ''}
              key={filter}
              type="button"
              onClick={() => onEdgeFilterChange(filter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="graphLegend">
        {Object.entries(ui.graphLegend).map(([kind, label]) => (
          <span className={`graphLegendItem ${kind}`} key={kind}>
            {label}
          </span>
        ))}
      </div>

      <div className="graphCanvas" role="img" aria-label={ui.graphView as string}>
        {graphNodes.length > 0 ? (
          <svg viewBox="0 0 600 500">
            {graphEdges.map((edge, index) => {
              const source = graphPositionById.get(edge.source);
              const target = graphPositionById.get(edge.target);

              if (!source || !target) {
                return null;
              }

              return (
                <line
                  className={`graphEdge ${edge.edgeType ?? 'related'}`}
                  key={`${edge.source}-${edge.target}-${index}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              );
            })}
            {positionedGraphNodes.map((node) => (
              <g
                className={`graphNode ${node.kind} ${selectedBlockId === node.blockId || selectedGraphNodeId === node.id ? 'selected' : ''}`}
                key={node.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelectGraphNode(node.id);

                  if (node.blockId) {
                    onSelectBlock(node.blockId);
                  }

                  if (node.kind === 'concept') {
                    onSearchConcept(node.label);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSelectGraphNode(node.id);
                    if (node.blockId) {
                      onSelectBlock(node.blockId);
                    }
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r={node.kind === 'block' ? 13 : 17} />
                <text x={node.x + 20} y={node.y + 4}>
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="emptyState">{ui.graphHint as string}</div>
        )}
      </div>

      <div className="graphNeighbors">
        <div className="graphNeighborsHeader">
          <strong>{ui.graphNeighbors as string}</strong>
          <span>{graphNeighbors.length}</span>
        </div>
        {graphNeighbors.length > 0 ? (
          <div className="graphNeighborList">
            {graphNeighbors.map((neighbor) => (
              <button
                className={`graphNeighborItem ${neighbor.edge.edgeType ?? 'related'}`}
                key={`${neighbor.edge.source}-${neighbor.edge.target}-${neighbor.edge.edgeType ?? 'related'}`}
                type="button"
                onClick={() => {
                  onSelectGraphNode(neighbor.node.id);
                  if (neighbor.node.blockId) {
                    onSelectBlock(neighbor.node.blockId);
                  }
                  if (neighbor.node.kind === 'concept') {
                    onSearchConcept(neighbor.node.label);
                  }
                }}
              >
                <span>{neighbor.edge.edgeType ?? 'related'}</span>
                <strong>{neighbor.node.label}</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="emptyState compact">{ui.graphNoNeighbors as string}</div>
        )}
      </div>
    </section>
  );
}
