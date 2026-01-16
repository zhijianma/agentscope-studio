import EChartsWrapper from '@/components/charts/EChartsWrapper';
import { useEvaluationTaskContext } from '@/context/EvaluationTaskContext';
import { BlockType, ToolUseBlock } from '@shared/types';
import { EvalTask, EvalTrajectory } from '@shared/types/evaluation.ts';
import type { EChartsOption } from 'echarts';
import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import type { ECharts } from 'echarts/core';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

echarts.use([TooltipComponent, SankeyChart, CanvasRenderer]);

interface SankeyNode {
    name: string;
    itemStyle?: { color: string };
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
    lineStyle?: { color: string; opacity: number };
}

// Clear colors for repeats - distinct and readable
const REPEAT_COLORS = [
    '#4a90c2', '#5cb85c', '#e6a23c', '#dc6b6b', '#36b3cc',
    '#3d9970', '#e67e45', '#8b5cb8', '#cc5588', '#20a0b0',
];

// Clear colors for tools - distinct and readable
const TOOL_COLORS = [
    '#7b4bc2', '#20a8a8', '#b84592', '#cc9933', '#4060c0',
    '#45a045', '#cc5830', '#3388cc', '#80b030', '#b85050',
];

// Clear status colors
const STATUS_COLORS = { success: '#52b352', failed: '#cc5252' };

const extractToolUseBlocks = (trajectory: EvalTrajectory): ToolUseBlock[] =>
    trajectory.filter((b): b is ToolUseBlock => b.type === BlockType.TOOL_USE);

const buildSankeyData = (
    task: EvalTask,
    successLabel: string,
    failedLabel: string,
) => {
    const nodeSet = new Set<string>();
    const links: SankeyLink[] = [];
    const repeatLinkIndices = new Map<string, number[]>();

    const repeats = Object.entries(task.repeats);
    let maxSteps = 0;

    const repeatColors = new Map<string, string>();
    repeats.forEach(([id], i) => repeatColors.set(id, REPEAT_COLORS[i % REPEAT_COLORS.length]));

    const toolsByStep = new Map<number, Set<string>>();
    const allToolNames = new Set<string>();

    repeats.forEach(([, data]) => {
        const tools = extractToolUseBlocks(data.solution?.trajectory || []);
        maxSteps = Math.max(maxSteps, tools.length);
        tools.forEach((t, i) => {
            if (!toolsByStep.has(i)) toolsByStep.set(i, new Set());
            toolsByStep.get(i)!.add(t.name);
            allToolNames.add(t.name);
        });
    });

    const toolColors = new Map<string, string>();
    Array.from(allToolNames).forEach((n, i) => toolColors.set(n, TOOL_COLORS[i % TOOL_COLORS.length]));

    repeats.forEach(([id]) => nodeSet.add(`repeat:${id}`));
    toolsByStep.forEach((names, step) => names.forEach((n) => nodeSet.add(`step${step}:${n}`)));
    const successNode = `status:${successLabel}`;
    const failedNode = `status:${failedLabel}`;
    nodeSet.add(successNode);
    nodeSet.add(failedNode);

    // Get link color from source node
    const getSourceNodeColor = (source: string): string => {
        if (source.startsWith('repeat:')) {
            return repeatColors.get(source.split(':')[1]) || REPEAT_COLORS[0];
        } else if (source.startsWith('step')) {
            return toolColors.get(source.split(':')[1]) || TOOL_COLORS[0];
        } else if (source.startsWith('status:')) {
            return source.includes(successLabel) ? STATUS_COLORS.success : STATUS_COLORS.failed;
        }
        return '#8c8c8c';
    };

    // Map from link index to repeatId for link hover support
    const linkIndexToRepeat = new Map<number, string>();

    repeats.forEach(([repeatId, data]) => {
        const tools = extractToolUseBlocks(data.solution?.trajectory || []);
        const isSuccess = data.solution?.success ?? false;
        const statusNode = isSuccess ? successNode : failedNode;
        const repeatNode = `repeat:${repeatId}`;
        const indices: number[] = [];

        const addLink = (source: string, target: string) => {
            const idx = links.length;
            indices.push(idx);
            linkIndexToRepeat.set(idx, repeatId);
            const color = getSourceNodeColor(source);
            links.push({ source, target, value: 1, lineStyle: { color, opacity: 0.5 } });
        };

        if (tools.length === 0) {
            addLink(repeatNode, statusNode);
        } else {
            addLink(repeatNode, `step0:${tools[0].name}`);
            for (let i = 0; i < tools.length - 1; i++) {
                addLink(`step${i}:${tools[i].name}`, `step${i + 1}:${tools[i + 1].name}`);
            }
            addLink(`step${tools.length - 1}:${tools[tools.length - 1].name}`, statusNode);
        }

        repeatLinkIndices.set(repeatId, indices);
    });

    const nodes: SankeyNode[] = Array.from(nodeSet).map((name) => {
        let color = '#8c8c8c';
        if (name.startsWith('repeat:')) {
            color = repeatColors.get(name.split(':')[1]) || REPEAT_COLORS[0];
        } else if (name.startsWith('step')) {
            color = toolColors.get(name.split(':')[1]) || TOOL_COLORS[0];
        } else if (name.startsWith('status:')) {
            color = name.includes(successLabel) ? STATUS_COLORS.success : STATUS_COLORS.failed;
        }
        return { name, itemStyle: { color } };
    });

    return { nodes, links, maxSteps, repeatColors, toolColors, repeatLinkIndices, linkIndexToRepeat };
};

const ChartPage: React.FC = () => {
    const { task } = useEvaluationTaskContext();
    const { t } = useTranslation();
    const chartRef = useRef<ECharts | null>(null);
    const highlightedRef = useRef<string | null>(null);

    const { nodes, links, maxSteps, repeatColors, toolColors, repeatLinkIndices, linkIndexToRepeat } = useMemo(
        () => buildSankeyData(task, t('common.success'), t('common.failed')),
        [task, t],
    );

    const updateLinkOpacities = useCallback(
        (chart: ECharts, highlightRepeatId: string | null) => {
            const highlightSet = highlightRepeatId
                ? new Set(repeatLinkIndices.get(highlightRepeatId) || [])
                : null;

            const updatedLinks = links.map((link, idx) => ({
                ...link,
                lineStyle: {
                    color: link.lineStyle?.color || '#999',
                    opacity: highlightSet ? (highlightSet.has(idx) ? 0.9 : 0.1) : 0.5,
                },
            }));

            chart.setOption({ series: [{ links: updatedLinks }] }, false);
        },
        [links, repeatLinkIndices],
    );

    const handleChartReady = useCallback(
        (chart: ECharts) => {
            chartRef.current = chart;

            chart.on('mouseover', (params: { name?: string; dataType?: string; dataIndex?: number }) => {
                let repeatId: string | undefined;

                // Handle repeat node hover
                if (params.name?.startsWith('repeat:')) {
                    repeatId = params.name.split(':')[1];
                }
                // Handle link hover
                else if (params.dataType === 'edge' && params.dataIndex !== undefined) {
                    repeatId = linkIndexToRepeat.get(params.dataIndex);
                }

                if (!repeatId || repeatId === highlightedRef.current) return;

                highlightedRef.current = repeatId;
                updateLinkOpacities(chart, repeatId);
            });

            chart.on('mouseout', (params: { name?: string; dataType?: string }) => {
                // Reset on repeat node or link mouseout
                if (params.name?.startsWith('repeat:') || params.dataType === 'edge') {
                    highlightedRef.current = null;
                    updateLinkOpacities(chart, null);
                }
            });
        },
        [updateLinkOpacities, linkIndexToRepeat],
    );

    const chartHeight = Math.max(400, (maxSteps + 3) * 80);

    const option: EChartsOption = useMemo(
        () => ({
            tooltip: { trigger: 'item', triggerOn: 'mousemove' },
            animation: false,
            series: [
                {
                    type: 'sankey',
                    top: 40,
                    bottom: 40,
                    left: '5%',
                    right: '5%',
                    data: nodes,
                    links: links,
                    orient: 'vertical',
                    nodeWidth: 20,
                    nodeGap: 15,
                    label: {
                        position: 'top',
                        fontSize: 11,
                        formatter: (p: { name?: string }) =>
                            p.name?.includes(':') ? p.name.split(':')[1] || p.name : p.name || '',
                    },
                    lineStyle: { curveness: 0.6 },
                    emphasis: { focus: 'none' },
                },
            ],
        }),
        [nodes, links],
    );

    if (nodes.length === 0) {
        return (
            <div className="col-span-full rounded-xl border shadow">
                <div className="p-6 pb-1">
                    <h3 className="text-sm font-medium">{t('common.trajectory')} Workflow</h3>
                </div>
                <div className="p-6 pt-2 text-center text-muted-foreground">
                    {t('hint.empty-trace')}
                </div>
            </div>
        );
    }

    const repeatLegend = Array.from(repeatColors.entries()).map(([id, color]) => (
        <div key={id} className="flex items-center gap-1.5">
            <div className="w-4 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">Repeat {id}</span>
        </div>
    ));

    const toolLegend = Array.from(toolColors.entries()).map(([name, color]) => (
        <div key={name} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{name}</span>
        </div>
    ));

    return (
        <div className="col-span-full rounded-xl border shadow">
            {/* <div className="p-6 pb-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-medium">{t('common.trajectory')} Workflow</h3>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-medium text-muted-foreground">Paths:</span>
                            {repeatLegend}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-medium text-muted-foreground">Tools:</span>
                            {toolLegend}
                        </div>
                    </div>
                </div>
            </div> */}
            <div className="p-6 pt-2">
                <EChartsWrapper
                    option={option}
                    style={{ width: '100%', height: `${chartHeight}px` }}
                    onChartReady={handleChartReady}
                />
            </div>
        </div>
    );
};

export default memo(ChartPage);
