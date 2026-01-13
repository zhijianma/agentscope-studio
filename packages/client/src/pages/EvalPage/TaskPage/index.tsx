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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs.tsx';
import { useEvaluationTaskContext } from '@/context/EvaluationTaskContext';
import { ModelCard, ToolCard } from '@/pages/EvalPage/EvaluationPage/DataCard';
import { formatNumber } from '@/utils/common';
import {
    BlockType,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
} from '@shared/types';
import { EvalTrajectory } from '@shared/types/evaluation.ts';
import { ChevronLeftIcon, CpuIcon, SettingsIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

const TokenUsageCard = memo(
    ({
        inputTokens,
        outputTokens,
    }: {
        inputTokens: number;
        outputTokens: number;
    }) => {
        const { t } = useTranslation();
        return (
            <div className="rounded-xl border shadow">
                <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-1">
                    <h3 className="tracking-tight text-sm font-medium">
                        {t('common.token-usage')}
                    </h3>
                    <CpuIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="p-6 min-h-[5.5rem] pt-2">
                    <div className="text-2xl font-bold">
                        {formatNumber(inputTokens + outputTokens)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs">
                                {t('common.prompt')}
                            </span>
                            <span className="text-sm font-medium">
                                {formatNumber(inputTokens)}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-muted-foreground text-xs">
                                {t('common.completion')}
                            </span>
                            <span className="text-sm font-medium">
                                {formatNumber(outputTokens)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

const TextStep = memo(
    ({
        block,
        stepIndex,
        isLast,
    }: {
        block: TextBlock;
        stepIndex: number;
        isLast: boolean;
    }) => {
        const { t } = useTranslation();
        return (
            <div className="flex flex-row items-start gap-4">
                <div className="flex mt-3 text-xs text-muted-foreground w-12 shrink-0">
                    {t('common.step')} {stepIndex}
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex rounded-full border-blue-600 border size-8 items-center justify-center my-2">
                        <div className="rounded-full border-blue-600 border size-4"></div>
                    </div>
                    {!isLast && (
                        <div className="w-px bg-border flex-1 min-h-4"></div>
                    )}
                </div>
                <div className="flex flex-1 text-sm items-center py-2">
                    {block.text}
                </div>
            </div>
        );
    },
);

const ToolStep = memo(
    ({
        toolUseBlock,
        toolResultBlock,
        stepIndex,
        isLast,
    }: {
        toolUseBlock: ToolUseBlock;
        toolResultBlock?: ToolResultBlock;
        stepIndex: number;
        isLast: boolean;
    }) => {
        const { t } = useTranslation();
        const [isOpen, setIsOpen] = useState(false);

        const toolInputString: string[] = [];
        Object.entries(toolUseBlock.input).forEach(([key, value]) => {
            toolInputString.push(`${key}=${JSON.stringify(value)}`);
        });

        const toolUseString = `(${toolInputString.join(',\n\t')})`;

        return (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex flex-row items-start gap-4">
                    <div className="flex mt-3 text-xs text-muted-foreground w-12 shrink-0">
                        {t('common.step')} {stepIndex}
                    </div>
                    <div className="flex flex-col items-center">
                        <CollapsibleTrigger asChild>
                            <div
                                className="flex rounded-full border-red-600 border size-8 items-center justify-center cursor-pointer hover:bg-muted transition-colors my-2"
                                title={
                                    toolResultBlock
                                        ? t('tooltip.click-to-view-result')
                                        : t('tooltip.no-result-available')
                                }
                            >
                                <div className="rounded-full border-red-600 border size-4"></div>
                            </div>
                        </CollapsibleTrigger>
                        {!isLast && (
                            <div className="w-px bg-border flex-1 min-h-4"></div>
                        )}
                    </div>
                    <div className="flex flex-1 text-sm items-center overflow-x-hidden py-2">
                        <span className="font-medium text-sm mr-1">
                            {toolUseBlock.name}
                        </span>
                        <span className="truncate text-muted-foreground">
                            {toolUseString}
                        </span>
                    </div>
                </div>
                <CollapsibleContent>
                    {toolResultBlock && (
                        <div className="ml-24 mb-2 p-3 rounded-lg bg-muted/50 border">
                            <div className="text-xs text-muted-foreground mb-1">
                                {t('common.result')}:
                            </div>
                            <pre className="text-sm whitespace-pre-wrap break-all">
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
                </CollapsibleContent>
            </Collapsible>
        );
    },
);

const TrajectoryCard = memo(
    ({ input, trajectory }: { input: string; trajectory: EvalTrajectory }) => {
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

        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('common.trajectory')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {input}
                    {toolSteps.map((step, index) => {
                        const isLast = index === toolSteps.length - 1;

                        if (step.type === BlockType.TEXT) {
                            return (
                                <TextStep
                                    key={`text-${index}`}
                                    block={step}
                                    stepIndex={index + 1}
                                    isLast={isLast}
                                />
                            );
                        }

                        if (step.type === BlockType.TOOL_USE) {
                            return (
                                <ToolStep
                                    key={step.id}
                                    toolUseBlock={step}
                                    toolResultBlock={resultMap[step.id]}
                                    stepIndex={index + 1}
                                    isLast={isLast}
                                />
                            );
                        }

                        return null;
                    })}
                </CardContent>
            </Card>
        );
    },
);

const TaskPage = () => {
    const { task } = useEvaluationTaskContext();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { evalId } = useParams<{ evalId: string }>();

    const handleBackToEvaluation = () => {
        navigate(`/eval/${evalId}`);
    };

    // Calculate progress from task.repeats and total_repeats
    const totalRepeats = task.total_repeats || Object.keys(task.repeats).length;
    const completedRepeats = Object.values(task.repeats).filter(
        (repeat) => repeat.solution !== undefined,
    ).length;
    const progress =
        totalRepeats > 0
            ? Math.round((completedRepeats / totalRepeats) * 100)
            : 0;

    const getStatus = () => {
        if (completedRepeats === totalRepeats) {
            return t('table.column.finished');
        }
        return t('table.column.incomplete');
    };

    // Aggregate stats from all repeats for overview
    const aggregatedLlm: Record<string, number> = {};
    const aggregatedTool: Record<string, number> = {};
    let aggregatedInputTokens = 0;
    let aggregatedOutputTokens = 0;

    Object.values(task.repeats).forEach((repeatData) => {
        const stats = repeatData.stats;
        if (!stats) return;

        // Aggregate LLM
        Object.entries(stats.llm || {}).forEach(([model, count]) => {
            aggregatedLlm[model] = (aggregatedLlm[model] || 0) + count;
        });

        // Aggregate Tool
        Object.entries(stats.tool || {}).forEach(([tool, count]) => {
            aggregatedTool[tool] = (aggregatedTool[tool] || 0) + count;
        });

        // Aggregate Tokens
        Object.values(stats.chat_usage || {}).forEach((usage) => {
            aggregatedInputTokens += usage.input_tokens || 0;
            aggregatedOutputTokens += usage.output_tokens || 0;
        });
    });

    return (
        <div className="flex-1 h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-6 h-full">
                <div
                    className="text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                    onClick={handleBackToEvaluation}
                >
                    <ChevronLeftIcon className="size-4" />
                    {t('action.back-to-evaluation')}
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="truncate font-bold text-xl">
                        {t('common.task')} {task.meta.id}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                        {t('common.evaluation')}: {task.meta.id}
                    </div>
                </div>

                {/* Status Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border shadow">
                        <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-1">
                            <h3 className="tracking-tight text-sm font-medium">
                                {t('common.status')}
                            </h3>
                            <SettingsIcon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="p-6 min-h-[5.5rem] pt-2 space-y-2">
                            <div className="text-2xl font-bold">
                                {getStatus()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('table.column.progress')}: {progress}% (
                                {completedRepeats}/{totalRepeats})
                            </div>
                        </div>
                    </div>
                </div>

                {/* Input Card */}
                <div className="rounded-xl border shadow">
                    <div className="p-6 flex flex-col justify-between space-y-0 pb-1">
                        <h3 className="tracking-tight text-sm font-medium">
                            {t('common.input')}
                        </h3>
                    </div>
                    <div className="p-6 min-h-[5.5rem] pt-2 space-y-4">
                        {task.meta.input}
                    </div>
                </div>

                {/* Ground Truth Card */}
                <div className="rounded-xl border shadow">
                    <div className="p-6 flex flex-col justify-between space-y-0 pb-1">
                        <h3 className="tracking-tight text-sm font-medium">
                            {t('table.column.ground-truth')}
                        </h3>
                    </div>
                    <div className="p-6 min-h-[5.5rem] pt-2 space-y-4">
                        {JSON.stringify(task.meta.ground_truth, null, 2)}
                    </div>
                </div>

                {/* Tabs with Overview and Repeats */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList>
                        <TabsTrigger value="overview">
                            {t('common.overview')}
                        </TabsTrigger>
                        {Object.keys(task.repeats).map((repeatId) => (
                            <TabsTrigger key={repeatId} value={repeatId}>
                                {`repeat ${repeatId}`}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* Overview Tab - Aggregated data */}
                    <TabsContent
                        value="overview"
                        className="flex flex-col gap-4"
                    >
                        {/* LLM and Tool Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ModelCard models={aggregatedLlm} />
                            <ToolCard tools={aggregatedTool} />
                        </div>

                        {/* Token Usage Card */}
                        <TokenUsageCard
                            inputTokens={aggregatedInputTokens}
                            outputTokens={aggregatedOutputTokens}
                        />
                    </TabsContent>

                    {Object.entries(task.repeats).map(
                        ([repeatId, repeatData]) => {
                            const stats = repeatData.stats;
                            const repeatInputTokens = stats
                                ? Object.values(stats.chat_usage || {}).reduce(
                                      (acc, usage) =>
                                          acc + (usage.input_tokens || 0),
                                      0,
                                  )
                                : 0;
                            const repeatOutputTokens = stats
                                ? Object.values(stats.chat_usage || {}).reduce(
                                      (acc, usage) =>
                                          acc + (usage.output_tokens || 0),
                                      0,
                                  )
                                : 0;

                            return (
                                <TabsContent
                                    key={repeatId}
                                    value={repeatId}
                                    className="flex flex-col gap-4"
                                >
                                    {/* Stats Cards for this repeat */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ModelCard models={stats?.llm ?? {}} />
                                        <ToolCard tools={stats?.tool ?? {}} />
                                    </div>

                                    {/* Token Usage Card for this repeat */}
                                    <TokenUsageCard
                                        inputTokens={repeatInputTokens}
                                        outputTokens={repeatOutputTokens}
                                    />

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                {t('common.output')}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {JSON.stringify(
                                                repeatData.solution?.output,
                                            ) || ''}
                                        </CardContent>
                                    </Card>

                                    <TrajectoryCard
                                        input={task.meta.input}
                                        trajectory={
                                            repeatData.solution?.trajectory ||
                                            []
                                        }
                                    />
                                </TabsContent>
                            );
                        },
                    )}
                </Tabs>
            </div>
        </div>
    );
};

export default memo(TaskPage);
