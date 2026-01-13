import { Button } from '@/components/ui/button.tsx';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card.tsx';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible.tsx';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useEvaluationTaskContext } from '@/context/EvaluationTaskContext';
import { formatNumber } from '@/utils/common';
import {
    BlockType,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
} from '@shared/types';
import { EvalTrajectory } from '@shared/types/evaluation.ts';
import { ChevronLeftIcon, CpuIcon, FilterIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

// Types for difference tracking - only trajectory comparison
interface RepeatDiff {
    trajectoryLength: boolean;
    trajectorySteps: boolean[];
}

// Deep equality check that ignores object key order
const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => deepEqual(item, b[index]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;
        const aKeys = Object.keys(aObj);
        const bKeys = Object.keys(bObj);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every(
            (key) => key in bObj && deepEqual(aObj[key], bObj[key]),
        );
    }

    return false;
};

// Helper to check if trajectory differs across repeats
const findDifferences = (
    repeatEntries: [string, RepeatData][],
): Map<string, RepeatDiff> => {
    const diffs = new Map<string, RepeatDiff>();
    if (repeatEntries.length < 2) return diffs;

    const getTrajectorySteps = (data: RepeatData) => {
        return (data.solution?.trajectory || []).filter(
            (b) => b.type !== BlockType.TOOL_RESULT,
        );
    };

    // Get first repeat as baseline for comparison
    const firstData = repeatEntries[0][1];
    const firstSteps = getTrajectorySteps(firstData);

    repeatEntries.forEach(([repeatId, data]) => {
        const steps = getTrajectorySteps(data);

        // Compare each step
        const maxSteps = Math.max(firstSteps.length, steps.length);
        const trajectorySteps: boolean[] = [];
        for (let i = 0; i < maxSteps; i++) {
            const firstStep = firstSteps[i];
            const currentStep = steps[i];
            if (!firstStep || !currentStep) {
                trajectorySteps.push(true); // Missing step = different
            } else if (firstStep.type !== currentStep.type) {
                trajectorySteps.push(true);
            } else if (firstStep.type === BlockType.TEXT) {
                trajectorySteps.push(
                    (firstStep as TextBlock).text !==
                        (currentStep as TextBlock).text,
                );
            } else if (firstStep.type === BlockType.TOOL_USE) {
                const firstTool = firstStep as ToolUseBlock;
                const currentTool = currentStep as ToolUseBlock;
                // Compare tool name and input (ignoring key order)
                trajectorySteps.push(
                    firstTool.name !== currentTool.name ||
                        !deepEqual(firstTool.input, currentTool.input),
                );
            } else {
                trajectorySteps.push(false);
            }
        }

        diffs.set(repeatId, {
            trajectoryLength: steps.length !== firstSteps.length,
            trajectorySteps,
        });
    });

    // Mark first item's trajectory length diff based on whether any other item differs
    const firstDiff = diffs.get(repeatEntries[0][0]);
    if (firstDiff) {
        firstDiff.trajectoryLength = Array.from(diffs.values()).some(
            (d) => d.trajectoryLength,
        );
    }

    return diffs;
};

// Helper component for diff highlighting
const DiffHighlight = ({
    isDiff,
    children,
    className = '',
}: {
    isDiff: boolean;
    children: React.ReactNode;
    className?: string;
}) => (
    <span
        className={`${className} ${isDiff ? 'bg-red-100 dark:bg-red-900/30 rounded px-1' : ''}`}
    >
        {children}
    </span>
);

type RepeatData = {
    solution?: {
        success: boolean;
        output: unknown;
        trajectory: EvalTrajectory;
        meta?: unknown;
    };
    stats?: {
        llm: Record<string, number>;
        tool: Record<string, number>;
        chat_usage: Record<
            string,
            { input_tokens: number; output_tokens: number }
        >;
    };
    result?: Record<string, unknown>;
};

// Compact Token Usage display for comparison
const TokenUsageCompact = memo(
    ({
        inputTokens,
        outputTokens,
    }: {
        inputTokens: number;
        outputTokens: number;
    }) => {
        const { t } = useTranslation();
        return (
            <div className="rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                    <CpuIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                        {t('common.token-usage')}
                    </span>
                </div>
                <div className="text-xl font-bold">
                    {formatNumber(inputTokens + outputTokens)}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>
                        {t('common.prompt')}: {formatNumber(inputTokens)}
                    </span>
                    <span>
                        {t('common.completion')}: {formatNumber(outputTokens)}
                    </span>
                </div>
            </div>
        );
    },
);

// Compact text step for comparison view
const TextStepCompact = memo(
    ({
        block,
        stepIndex,
        isDiff,
    }: {
        block: TextBlock;
        stepIndex: number;
        isDiff?: boolean;
    }) => {
        return (
            <div
                className={`flex gap-2 py-1 ${isDiff ? 'bg-red-50 dark:bg-red-900/20 rounded px-1' : ''}`}
            >
                <div
                    className={`flex items-center justify-center size-6 rounded-full border text-xs shrink-0 ${isDiff ? 'border-red-600 bg-red-100 dark:bg-red-900' : 'border-blue-600'}`}
                >
                    {stepIndex}
                </div>
                <div className="text-sm flex-1">{block.text}</div>
            </div>
        );
    },
);

// Compact tool step for comparison view
const ToolStepCompact = memo(
    ({
        toolUseBlock,
        toolResultBlock,
        stepIndex,
        isDiff,
        isOpen,
        onToggle,
    }: {
        toolUseBlock: ToolUseBlock;
        toolResultBlock?: ToolResultBlock;
        stepIndex: number;
        isDiff?: boolean;
        isOpen: boolean;
        onToggle: () => void;
    }) => {
        const { t } = useTranslation();

        return (
            <Collapsible open={isOpen} onOpenChange={onToggle}>
                <CollapsibleTrigger asChild>
                    <div
                        className={`flex gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded ${isDiff ? 'bg-red-50 dark:bg-red-900/20 px-1' : ''}`}
                    >
                        <div
                            className={`flex items-center justify-center size-6 rounded-full border text-xs shrink-0 ${isDiff ? 'border-red-600 bg-red-100 dark:bg-red-900' : 'border-red-600'}`}
                        >
                            {stepIndex}
                        </div>
                        <div className="text-sm flex-1 overflow-hidden">
                            <div className="font-medium">
                                {toolUseBlock.name}
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="ml-8 mt-1 mb-2 space-y-2">
                        {/* Input params */}
                        <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs">
                            <div className="text-muted-foreground mb-1">
                                {t('common.input')}:
                            </div>
                            <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                                {JSON.stringify(toolUseBlock.input, null, 2)}
                            </pre>
                        </div>
                        {/* Result */}
                        {toolResultBlock && (
                            <div className="p-2 rounded bg-muted/50 border text-xs">
                                <div className="text-muted-foreground mb-1">
                                    {t('common.output')}:
                                </div>
                                <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                                    {typeof toolResultBlock.output === 'string'
                                        ? toolResultBlock.output
                                        : JSON.stringify(
                                              toolResultBlock.output,
                                              null,
                                              2,
                                          )}
                                </pre>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        );
    },
);

// Compact trajectory for comparison view
const TrajectoryCompact = memo(
    ({
        trajectory,
        stepDiffs,
        expandedSteps,
        onToggleStep,
    }: {
        trajectory: EvalTrajectory;
        stepDiffs?: boolean[];
        expandedSteps: Set<number>;
        onToggleStep: (stepIndex: number) => void;
    }) => {
        const { t } = useTranslation();
        const resultMap: Record<string, ToolResultBlock> = {};
        trajectory.forEach((block) => {
            if (block.type === BlockType.TOOL_RESULT) {
                resultMap[block.id] = block;
            }
        });
        const toolSteps = trajectory.filter(
            (block) => block.type !== BlockType.TOOL_RESULT,
        );

        if (toolSteps.length === 0) {
            return (
                <div className="text-sm text-muted-foreground">
                    {t('default-page.no-data-available')}
                </div>
            );
        }

        return (
            <div className="space-y-1">
                {toolSteps.map((step, index) => {
                    const stepIsDiff = stepDiffs?.[index] || false;
                    if (step.type === BlockType.TEXT) {
                        return (
                            <TextStepCompact
                                key={`text-${index}`}
                                block={step}
                                stepIndex={index + 1}
                                isDiff={stepIsDiff}
                            />
                        );
                    }

                    if (step.type === BlockType.TOOL_USE) {
                        return (
                            <ToolStepCompact
                                key={step.id}
                                toolUseBlock={step}
                                toolResultBlock={resultMap[step.id]}
                                stepIndex={index + 1}
                                isDiff={stepIsDiff}
                                isOpen={expandedSteps.has(index)}
                                onToggle={() => onToggleStep(index)}
                            />
                        );
                    }

                    return null;
                })}
            </div>
        );
    },
);

// Single repeat column for comparison
const RepeatColumn = memo(
    ({
        repeatId,
        repeatData,
        diff,
        expandedSteps,
        onToggleStep,
        outputScrollTop,
        trajectoryScrollTop,
        onOutputScroll,
        onTrajectoryScroll,
    }: {
        repeatId: string;
        repeatData: RepeatData;
        diff?: RepeatDiff;
        expandedSteps: Set<number>;
        onToggleStep: (stepIndex: number) => void;
        outputScrollTop: number;
        trajectoryScrollTop: number;
        onOutputScroll: (scrollTop: number) => void;
        onTrajectoryScroll: (scrollTop: number) => void;
    }) => {
        const { t } = useTranslation();
        const outputScrollRef = useRef<HTMLDivElement>(null);
        const trajectoryScrollRef = useRef<HTMLDivElement>(null);
        const isScrollingRef = useRef(false);

        // Sync output scroll position
        useEffect(() => {
            const el = outputScrollRef.current?.querySelector(
                '[data-radix-scroll-area-viewport]',
            ) as HTMLElement | null;
            if (el && !isScrollingRef.current) {
                el.scrollTop = outputScrollTop;
            }
        }, [outputScrollTop]);

        // Sync trajectory scroll position
        useEffect(() => {
            const el = trajectoryScrollRef.current?.querySelector(
                '[data-radix-scroll-area-viewport]',
            ) as HTMLElement | null;
            if (el && !isScrollingRef.current) {
                el.scrollTop = trajectoryScrollTop;
            }
        }, [trajectoryScrollTop]);

        // Handle output scroll
        const handleOutputScroll = useCallback(
            (e: Event) => {
                const target = e.target as HTMLElement;
                isScrollingRef.current = true;
                onOutputScroll(target.scrollTop);
                setTimeout(() => {
                    isScrollingRef.current = false;
                }, 50);
            },
            [onOutputScroll],
        );

        // Handle trajectory scroll
        const handleTrajectoryScroll = useCallback(
            (e: Event) => {
                const target = e.target as HTMLElement;
                isScrollingRef.current = true;
                onTrajectoryScroll(target.scrollTop);
                setTimeout(() => {
                    isScrollingRef.current = false;
                }, 50);
            },
            [onTrajectoryScroll],
        );

        // Attach scroll listeners
        useEffect(() => {
            const outputEl = outputScrollRef.current?.querySelector(
                '[data-radix-scroll-area-viewport]',
            ) as HTMLElement | null;
            const trajectoryEl = trajectoryScrollRef.current?.querySelector(
                '[data-radix-scroll-area-viewport]',
            ) as HTMLElement | null;

            if (outputEl) {
                outputEl.addEventListener('scroll', handleOutputScroll);
            }
            if (trajectoryEl) {
                trajectoryEl.addEventListener('scroll', handleTrajectoryScroll);
            }

            return () => {
                if (outputEl) {
                    outputEl.removeEventListener('scroll', handleOutputScroll);
                }
                if (trajectoryEl) {
                    trajectoryEl.removeEventListener(
                        'scroll',
                        handleTrajectoryScroll,
                    );
                }
            };
        }, [handleOutputScroll, handleTrajectoryScroll]);
        const stats = repeatData.stats;
        const inputTokens = stats
            ? Object.values(stats.chat_usage || {}).reduce(
                  (acc, usage) => acc + (usage.input_tokens || 0),
                  0,
              )
            : 0;
        const outputTokens = stats
            ? Object.values(stats.chat_usage || {}).reduce(
                  (acc, usage) => acc + (usage.output_tokens || 0),
                  0,
              )
            : 0;

        const llmTotal = stats
            ? Object.values(stats.llm || {}).reduce((acc, v) => acc + v, 0)
            : 0;
        const toolTotal = stats
            ? Object.values(stats.tool || {}).reduce((acc, v) => acc + v, 0)
            : 0;

        return (
            <div className="flex flex-col gap-3 w-[320px] shrink-0">
                {/* Header */}
                <div className="font-medium text-sm rounded-lg p-2 text-center bg-muted/50">
                    Repeat {repeatId}
                    {repeatData.solution?.success !== undefined && (
                        <span
                            className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                repeatData.solution.success
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                            }`}
                        >
                            {repeatData.solution.success
                                ? t('common.success')
                                : t('common.failed')}
                        </span>
                    )}
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border p-2 text-center">
                        <div className="text-muted-foreground">LLM</div>
                        <div className="font-medium">{llmTotal}</div>
                    </div>
                    <div className="rounded-lg border p-2 text-center">
                        <div className="text-muted-foreground">Tool</div>
                        <div className="font-medium">{toolTotal}</div>
                    </div>
                </div>

                {/* Token Usage */}
                <TokenUsageCompact
                    inputTokens={inputTokens}
                    outputTokens={outputTokens}
                />

                {/* Output */}
                <Card className="flex-shrink-0">
                    <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm">
                            {t('common.output')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div ref={outputScrollRef}>
                            <ScrollArea className="h-24">
                                <pre className="text-xs whitespace-pre-wrap break-all">
                                    {JSON.stringify(
                                        repeatData.solution?.output,
                                        null,
                                        2,
                                    ) || t('default-page.no-data-available')}
                                </pre>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>

                {/* Trajectory */}
                <Card
                    className={`flex-1 ${diff?.trajectoryLength ? 'border-red-200 dark:border-red-800' : ''}`}
                >
                    <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            {t('common.trajectory')} (
                            <DiffHighlight
                                isDiff={diff?.trajectoryLength || false}
                            >
                                {repeatData.solution?.trajectory?.filter(
                                    (b) => b.type !== BlockType.TOOL_RESULT,
                                ).length || 0}
                            </DiffHighlight>{' '}
                            steps)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div ref={trajectoryScrollRef}>
                            <ScrollArea className="h-64">
                                <TrajectoryCompact
                                    trajectory={
                                        repeatData.solution?.trajectory || []
                                    }
                                    stepDiffs={diff?.trajectorySteps}
                                    expandedSteps={expandedSteps}
                                    onToggleStep={onToggleStep}
                                />
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    },
);

const TaskComparisonPage = () => {
    const { task } = useEvaluationTaskContext();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { evalId } = useParams<{ evalId: string; taskId: string }>();

    // All repeat IDs
    const allRepeatIds = Object.keys(task.repeats);

    // State for selected repeats - default to all
    const [selectedRepeatIds, setSelectedRepeatIds] =
        useState<string[]>(allRepeatIds);

    const handleBackToTask = () => {
        navigate(`/eval/${evalId}/${task.meta.id}`);
    };

    const handleToggleRepeat = (repeatId: string, checked: boolean) => {
        if (checked) {
            setSelectedRepeatIds((prev) => [...prev, repeatId]);
        } else {
            setSelectedRepeatIds((prev) =>
                prev.filter((id) => id !== repeatId),
            );
        }
    };

    const handleSelectAll = () => {
        setSelectedRepeatIds(allRepeatIds);
    };

    const handleUnselectAll = () => {
        setSelectedRepeatIds([]);
    };

    const isAllSelected = selectedRepeatIds.length === allRepeatIds.length;

    // State for expanded steps - shared across all repeat columns
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

    const handleToggleStep = (stepIndex: number) => {
        setExpandedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepIndex)) {
                next.delete(stepIndex);
            } else {
                next.add(stepIndex);
            }
            return next;
        });
    };

    // State for synchronized scroll positions
    const [outputScrollTop, setOutputScrollTop] = useState(0);
    const [trajectoryScrollTop, setTrajectoryScrollTop] = useState(0);

    const handleOutputScroll = useCallback((scrollTop: number) => {
        setOutputScrollTop(scrollTop);
    }, []);

    const handleTrajectoryScroll = useCallback((scrollTop: number) => {
        setTrajectoryScrollTop(scrollTop);
    }, []);

    const repeatEntries = Object.entries(task.repeats).filter(([repeatId]) =>
        selectedRepeatIds.includes(repeatId),
    ) as [string, RepeatData][];

    // Calculate differences between repeats
    const differences = useMemo(
        () => findDifferences(repeatEntries),
        [repeatEntries],
    );

    // Count total trajectory step differences
    const diffCount = useMemo(() => {
        let count = 0;
        differences.forEach((diff) => {
            diff.trajectorySteps.forEach((s) => {
                if (s) count++;
            });
        });
        // Divide by number of repeats since each diff step is counted for each repeat
        return repeatEntries.length > 0
            ? Math.ceil(count / repeatEntries.length)
            : 0;
    }, [differences, repeatEntries.length]);

    return (
        <div className="flex-1 h-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b shrink-0">
                <div
                    className="text-muted-foreground mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                    onClick={handleBackToTask}
                >
                    <ChevronLeftIcon className="size-4" />
                    {t('action.back-to-task')}
                </div>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="font-bold text-xl flex items-center gap-3">
                            {t('common.comparison')}: {task.meta.id}
                            {diffCount > 0 && (
                                <span className="text-sm font-normal text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                    {diffCount} {t('common.differences')}
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {t('description.comparison-subtitle', {
                                count: repeatEntries.length,
                            })}
                        </div>
                    </div>

                    {/* Repeat Selection */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <FilterIcon className="size-4" />
                                {t('action.select-repeats')} (
                                {selectedRepeatIds.length}/{allRepeatIds.length}
                                )
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuCheckboxItem
                                checked={isAllSelected}
                                onCheckedChange={() => {
                                    if (isAllSelected) {
                                        handleUnselectAll();
                                    } else {
                                        handleSelectAll();
                                    }
                                }}
                                onSelect={(e) => e.preventDefault()}
                            >
                                {isAllSelected
                                    ? t('action.unselect-all')
                                    : t('action.select-all')}
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            {allRepeatIds.map((repeatId) => (
                                <DropdownMenuCheckboxItem
                                    key={repeatId}
                                    checked={selectedRepeatIds.includes(
                                        repeatId,
                                    )}
                                    onCheckedChange={(checked) => {
                                        handleToggleRepeat(repeatId, checked);
                                    }}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    Repeat {repeatId}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Task Input - Shared across all repeats */}
            <div className="px-6 py-3 border-b shrink-0">
                <div className="text-sm font-medium mb-1">
                    {t('common.input')}
                </div>
                <div className="text-sm text-muted-foreground max-h-20 overflow-auto">
                    {task.meta.input}
                </div>
            </div>

            {/* Comparison Grid */}
            <div className="flex-1 overflow-auto p-6">
                <div className="flex gap-4 min-w-min">
                    {repeatEntries.map(([repeatId, repeatData]) => (
                        <RepeatColumn
                            key={repeatId}
                            repeatId={repeatId}
                            repeatData={repeatData}
                            diff={differences.get(repeatId)}
                            expandedSteps={expandedSteps}
                            onToggleStep={handleToggleStep}
                            outputScrollTop={outputScrollTop}
                            trajectoryScrollTop={trajectoryScrollTop}
                            onOutputScroll={handleOutputScroll}
                            onTrajectoryScroll={handleTrajectoryScroll}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(TaskComparisonPage);
