import React from 'react';
import { ToolDefinition, CutterSection } from '../types';

interface BitProfilePreviewProps {
  tool: ToolDefinition;
  units?: string;
  width?: number;
  height?: number;
  showDimensions?: boolean;
  className?: string;
}

export const BitProfilePreview: React.FC<BitProfilePreviewProps> = ({
  tool,
  units = 'mm',
  width = 160,
  height = 200,
  showDimensions = true,
  className = '',
}) => {
  const colletDia = tool.colletDiameter || tool.diameter || 6.35;
  const sections = tool.sections && tool.sections.length > 0
    ? tool.sections
    : [
        {
          id: 'sec_default',
          type: 'straight' as const,
          diameter: tool.diameter || 6.35,
          height: tool.fluteLength || (units === 'inch' ? 0.75 : 20),
        },
      ];

  // Calculate total cutter height & maximum profile diameter
  let totalCutterHeight = 0;
  let maxProfileDia = colletDia;

  for (const sec of sections) {
    totalCutterHeight += Math.max(0.1, sec.height || 1);
    maxProfileDia = Math.max(maxProfileDia, sec.diameter || 0, sec.endDiameter || 0);
  }

  // Add shank height proportional to cutter
  const shankHeight = Math.max(totalCutterHeight * 0.6, totalCutterHeight > 5 ? 15 : 0.6);
  const totalToolHeight = shankHeight + totalCutterHeight;

  // SVG coordinate layout & margins
  const marginX = showDimensions ? 28 : 8;
  const marginY = showDimensions ? 20 : 8;
  const drawW = width - marginX * 2;
  const drawH = height - marginY * 2;

  const scaleX = drawW / (maxProfileDia * 1.25 || 1);
  const scaleY = drawH / (totalToolHeight * 1.1 || 1);
  const scale = Math.min(scaleX, scaleY);

  const centerX = width / 2;
  const topY = marginY + 6;

  // 1. Build Left & Right Profile Paths
  const leftPoints: { x: number; y: number }[] = [];
  const rightPoints: { x: number; y: number }[] = [];

  // Top of shank
  const shankR = (colletDia / 2) * scale;
  const shankBottomY = topY + shankHeight * scale;

  leftPoints.push({ x: centerX - shankR, y: topY });
  leftPoints.push({ x: centerX - shankR, y: shankBottomY });

  rightPoints.push({ x: centerX + shankR, y: topY });
  rightPoints.push({ x: centerX + shankR, y: shankBottomY });

  // Sequentially trace cutter sections
  let curY = shankBottomY;

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx];
    const secH = Math.max(0.1, sec.height) * scale;
    const startR = ((sec.diameter || tool.diameter) / 2) * scale;
    const nextY = curY + secH;

    if (sec.type === 'straight') {
      leftPoints.push({ x: centerX - startR, y: curY });
      leftPoints.push({ x: centerX - startR, y: nextY });

      rightPoints.push({ x: centerX + startR, y: curY });
      rightPoints.push({ x: centerX + startR, y: nextY });
    } else if (sec.type === 'angled') {
      let endR = startR;
      if (sec.endDiameter !== undefined) {
        endR = (sec.endDiameter / 2) * scale;
      } else if (sec.taperAngle !== undefined) {
        const rad = (sec.taperAngle * Math.PI) / 180;
        endR = Math.max(0, startR - Math.tan(rad / 2) * secH);
      } else {
        endR = 0; // Default V-point
      }

      leftPoints.push({ x: centerX - startR, y: curY });
      leftPoints.push({ x: centerX - endR, y: nextY });

      rightPoints.push({ x: centerX + startR, y: curY });
      rightPoints.push({ x: centerX + endR, y: nextY });
    } else if (sec.type === 'outside-arc') {
      // Convex / Ball nose / Roundover
      const endR = sec.endDiameter !== undefined ? (sec.endDiameter / 2) * scale : 0;
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = (t * Math.PI) / 2; // 0 to 90 deg
        const r = startR * Math.cos(angle) + endR * (1 - Math.cos(angle));
        const y = curY + Math.sin(angle) * secH;

        if (i === 0) {
          leftPoints.push({ x: centerX - startR, y: curY });
          rightPoints.push({ x: centerX + startR, y: curY });
        } else {
          leftPoints.push({ x: centerX - r, y: y });
          rightPoints.push({ x: centerX + r, y: y });
        }
      }
    } else if (sec.type === 'inside-arc') {
      // Concave / Cove / Finger pull scoop
      const endR = sec.endDiameter !== undefined ? (sec.endDiameter / 2) * scale : startR * 0.3;
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = (t * Math.PI) / 2;
        const r = startR - (startR - endR) * Math.sin(angle);
        const y = curY + (1 - Math.cos(angle)) * secH;

        if (i === 0) {
          leftPoints.push({ x: centerX - startR, y: curY });
          rightPoints.push({ x: centerX + startR, y: curY });
        } else {
          leftPoints.push({ x: centerX - r, y: y });
          rightPoints.push({ x: centerX + r, y: y });
        }
      }
    }

    curY = nextY;
  }

  // Combine polygon: top-left -> down left side -> bottom center -> up right side -> top-right -> close
  let pathD = `M ${leftPoints[0].x} ${leftPoints[0].y}`;
  for (let i = 1; i < leftPoints.length; i++) {
    pathD += ` L ${leftPoints[i].x} ${leftPoints[i].y}`;
  }
  // Bottom center
  const bottomTip = { x: centerX, y: curY };
  pathD += ` L ${bottomTip.x} ${bottomTip.y}`;

  // Up right side in reverse
  for (let i = rightPoints.length - 1; i >= 0; i--) {
    pathD += ` L ${rightPoints[i].x} ${rightPoints[i].y}`;
  }
  pathD += ' Z';

  // Cutting edge highlight path (flutes only, below shank)
  const fluteLeft = leftPoints.slice(1);
  const fluteRight = rightPoints.slice(1);
  let cuttingEdgeD = '';
  if (fluteLeft.length > 0) {
    cuttingEdgeD += `M ${fluteLeft[0].x} ${fluteLeft[0].y}`;
    for (let i = 1; i < fluteLeft.length; i++) cuttingEdgeD += ` L ${fluteLeft[i].x} ${fluteLeft[i].y}`;
    cuttingEdgeD += ` L ${bottomTip.x} ${bottomTip.y}`;
    for (let i = fluteRight.length - 1; i >= 0; i--) cuttingEdgeD += ` L ${fluteRight[i].x} ${fluteRight[i].y}`;
  }

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          {/* Metallic Shank Gradient */}
          <linearGradient id={`shank_grad_${tool.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="25%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="75%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Carbide Flute Gradient */}
          <linearGradient id={`carbide_grad_${tool.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="30%" stopColor="#334155" />
            <stop offset="55%" stopColor="#64748b" />
            <stop offset="85%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Centerline Rotation Axis */}
        <line
          x1={centerX}
          y1={topY - 4}
          x2={centerX}
          y2={curY + 8}
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Solid Bit Silhouette */}
        <path
          d={pathD}
          fill={`url(#carbide_grad_${tool.id})`}
          stroke="#475569"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Shank Overlay */}
        <rect
          x={centerX - shankR}
          y={topY}
          width={shankR * 2}
          height={shankHeight * scale}
          fill={`url(#shank_grad_${tool.id})`}
          stroke="#475569"
          strokeWidth="1"
        />

        {/* Cutting Edge Highlight in Tool Color */}
        {cuttingEdgeD && (
          <path
            d={cuttingEdgeD}
            fill="none"
            stroke={tool.color || '#3b82f6'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />
        )}

        {/* Flute Spiral Indicator Lines */}
        {sections.map((sec, idx) => {
          const yStart = shankBottomY + idx * 12;
          return (
            <path
              key={idx}
              d={`M ${centerX - 4} ${yStart + 4} Q ${centerX} ${yStart + 8} ${centerX + 4} ${yStart + 12}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="0.8"
              opacity="0.4"
            />
          );
        })}

        {/* Dimension Ticks & Labels */}
        {showDimensions && (
          <>
            {/* Shank / Collet Diameter Top Dimension */}
            <g className="text-[9px] fill-slate-400 font-mono">
              <line
                x1={centerX - shankR}
                y1={topY - 4}
                x2={centerX + shankR}
                y2={topY - 4}
                stroke="#64748b"
                strokeWidth="0.75"
              />
              <text x={centerX} y={topY - 7} textAnchor="middle">
                Shank Ø{colletDia}
              </text>
            </g>

            {/* Cut Diameter Bottom Dimension */}
            <g className="text-[10px] fill-slate-200 font-mono font-semibold">
              <line
                x1={centerX - (tool.diameter / 2) * scale}
                y1={curY + 7}
                x2={centerX + (tool.diameter / 2) * scale}
                y2={curY + 7}
                stroke="#38bdf8"
                strokeWidth="1"
              />
              <text x={centerX} y={curY + 18} textAnchor="middle">
                Ø {tool.diameter} {units}
              </text>
            </g>

            {/* Cut Length Height Dimension (Right side) */}
            <g className="text-[9px] fill-slate-400 font-mono">
              <line
                x1={width - marginX + 4}
                y1={shankBottomY}
                x2={width - marginX + 4}
                y2={curY}
                stroke="#64748b"
                strokeWidth="0.75"
              />
              <text
                x={width - marginX + 8}
                y={(shankBottomY + curY) / 2 + 3}
                textAnchor="start"
              >
                {totalCutterHeight.toFixed(1)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
};
