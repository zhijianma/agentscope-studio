import { Layout } from 'antd';
import { memo } from 'react';
import { Route, Routes } from 'react-router-dom';

import { EvaluationContextProvider } from '@/context/EvaluationContext.tsx';
import { EvaluationListContextProvider } from '@/context/EvaluationListContext.tsx';
import { EvaluationTaskContextProvider } from '@/context/EvaluationTaskContext.tsx';
import EvaluationPage from '@/pages/EvalPage/EvaluationPage';
import OverviewPage from '@/pages/EvalPage/OverviewPage';
import TaskComparisonPage from '@/pages/EvalPage/TaskComparisonPage';
import TaskPage from '@/pages/EvalPage/TaskPage';
import { RouterPath } from '@/pages/RouterPath.ts';

const EvalPage = () => {
    return (
        <Layout className="w-full h-full">
            {/*<TitleBar title={t('common.evaluation')} />*/}

            <Routes>
                <Route
                    index
                    element={
                        <EvaluationListContextProvider>
                            <OverviewPage />
                        </EvaluationListContextProvider>
                    }
                />
                <Route
                    path={RouterPath.EVAL_EVALUATION}
                    element={
                        <EvaluationContextProvider>
                            <EvaluationPage />
                        </EvaluationContextProvider>
                    }
                />
                <Route
                    path={RouterPath.EVAL_TASK}
                    element={
                        <EvaluationTaskContextProvider>
                            <TaskPage />
                        </EvaluationTaskContextProvider>
                    }
                />
                <Route
                    path={RouterPath.EVAL_TASK_COMPARISON}
                    element={
                        <EvaluationTaskContextProvider>
                            <TaskComparisonPage />
                        </EvaluationTaskContextProvider>
                    }
                />
            </Routes>
        </Layout>
    );
};
export default memo(EvalPage);
