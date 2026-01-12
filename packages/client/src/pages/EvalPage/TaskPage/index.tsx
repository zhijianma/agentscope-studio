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
import {
    BlockType,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
} from '@shared/types';
import { EvalStats, EvalTrajectory } from '@shared/types/evaluation.ts';
import { ChevronLeftIcon, SettingsIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

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

const StatsCard = memo(({ stats }: { stats?: EvalStats }) => {
    const { t } = useTranslation();

    if (!stats) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('common.stats')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-muted-foreground text-sm">
                        {t('default-page.no-data-available')}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Calculate total tokens
    const totalInputTokens = Object.values(stats.chat_usage || {}).reduce(
        (acc, usage) => acc + (usage.input_tokens || 0),
        0,
    );
    const totalOutputTokens = Object.values(stats.chat_usage || {}).reduce(
        (acc, usage) => acc + (usage.output_tokens || 0),
        0,
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('common.stats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* LLM Stats */}
                {stats.llm && Object.keys(stats.llm).length > 0 && (
                    <div>
                        <div className="text-sm font-medium mb-2">
                            {t('common.llm')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(stats.llm).map(([model, count]) => (
                                <div
                                    key={model}
                                    className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1"
                                >
                                    <span className="truncate text-muted-foreground">
                                        {model}
                                    </span>
                                    <span className="font-medium">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tool Stats */}
                {stats.tool && Object.keys(stats.tool).length > 0 && (
                    <div>
                        <div className="text-sm font-medium mb-2">
                            {t('common.tool')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(stats.tool).map(([tool, count]) => (
                                <div
                                    key={tool}
                                    className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1"
                                >
                                    <span className="truncate text-muted-foreground">
                                        {tool}
                                    </span>
                                    <span className="font-medium">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Token Usage */}
                {stats.chat_usage &&
                    Object.keys(stats.chat_usage).length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-2">
                                {t('common.token-usage')}
                            </div>
                            <div className="space-y-2">
                                {Object.entries(stats.chat_usage).map(
                                    ([model, usage]) => (
                                        <div
                                            key={model}
                                            className="text-sm bg-muted/50 rounded px-2 py-1"
                                        >
                                            <div className="font-medium truncate mb-1">
                                                {model}
                                            </div>
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>
                                                    {t('common.input')}:{' '}
                                                    {usage.input_tokens}
                                                </span>
                                                <span>
                                                    {t('common.output')}:{' '}
                                                    {usage.output_tokens}
                                                </span>
                                            </div>
                                        </div>
                                    ),
                                )}
                                <div className="flex justify-between text-sm font-medium pt-1 border-t">
                                    <span>{t('common.total')}</span>
                                    <span>
                                        {totalInputTokens} + {totalOutputTokens}{' '}
                                        = {totalInputTokens + totalOutputTokens}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
            </CardContent>
        </Card>
    );
});

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

    return (
        <div className="flex-1 h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6 h-full">
                <div
                    className="text-muted-foreground mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                    onClick={handleBackToEvaluation}
                >
                    <ChevronLeftIcon className="size-4" />
                    {t('action.back-to-evaluation')}
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="truncate font-bold text-xl">
                        {t('common.task')} {task.meta.id}
                    </div>
                    <div className="truncate text-sm text-muted-foreground mb-3">
                        {t('common.evaluation')}: {task.meta.id}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <div className="rounded-xl border shadow">
                            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-1">
                                <h3 className="tracking-tight text-sm font-medium">
                                    {t('common.status')}
                                </h3>
                                <SettingsIcon className="size-4 text-muted-foreground" />
                            </div>
                            <div className="p-6 min-h-[5.5rem] pt-2 space-y-4">
                                <div>{t('status.unknown')}</div>
                                <div>{t('table.column.progress')}: 12%</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-full rounded-xl border shadow">
                        <div className="p-6 flex flex-col justify-between space-y-0 pb-1">
                            <h3 className="tracking-tight text-sm font-medium">
                                {t('common.input')}
                            </h3>
                        </div>
                        <div className="p-6 min-h-[5.5rem] pt-2 space-y-4">
                            {task.meta.input}
                        </div>
                    </div>

                    <div className="col-span-full rounded-xl border shadow">
                        <div className="p-6 flex flex-col justify-between space-y-0 pb-1">
                            <h3 className="tracking-tight text-sm font-medium">
                                {t('table.column.ground-truth')}
                            </h3>
                        </div>
                        <div className="p-6 min-h-[5.5rem] pt-2 space-y-4">
                            {JSON.stringify(task.meta.ground_truth, null, 2)}
                        </div>
                    </div>

                    {/*<Segmented*/}
                    {/*    className="col-span-full"*/}
                    {/*    options={[*/}
                    {/*        'overview',*/}
                    {/*        ...Object.keys(task.repeats).map(*/}
                    {/*            (repeatId) => `repeatId: ${repeatId}`,*/}
                    {/*        ),*/}
                    {/*    ]}*/}
                    {/*/>*/}

                    {/*<div className="col-span-full rounded-xl border shadow">*/}
                    {/*    <div className="p-6 flex flex-col justify-between space-y-0 pb-1">*/}
                    {/*        <h3 className="tracking-tight text-sm font-medium">*/}
                    {/*            Output*/}
                    {/*        </h3>*/}
                    {/*    </div>*/}
                    {/*    <div className="p-6 min-h-[5.5rem] pt-2 space-y-4"></div>*/}
                    {/*</div>*/}

                    {/*<div className="col-span-full rounded-xl border shadow">*/}
                    {/*    <div className="p-6 flex flex-col justify-between space-y-0 pb-1">*/}
                    {/*        <h3 className="tracking-tight text-sm font-medium">*/}
                    {/*            Trajectory*/}
                    {/*        </h3>*/}
                    {/*    </div>*/}
                    {/*    <div className="p-6 min-h-[5.5rem] pt-2 space-y-4"></div>*/}
                    {/*</div>*/}

                    <Tabs defaultValue="0" className="col-span-full">
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
                        {Object.entries(task.repeats).map(
                            ([repeatId, repeatData]) => (
                                <TabsContent
                                    key={repeatId}
                                    value={repeatId}
                                    className="flex flex-col gap-4"
                                >
                                    <StatsCard stats={repeatData.stats} />

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
                            ),
                        )}
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default memo(TaskPage);
