'use client';
import { useEffect, useState } from 'react';
import { getStatus, initCase } from '@/lib/apiClient';
import { useCaseStore, FlowStep, getCaseId, setCaseId } from '@/lib/case-store';
import type { CaseSnapshot } from '@/lib/types';
import StartStep from '../_steps/StartStep';
import QuestionnaireStep from '../_steps/QuestionnaireStep';
import UploadStep from '../_steps/UploadStep';
import EligibilityStep from '../_steps/EligibilityStep';
import SummaryStep from '../_steps/SummaryStep';
import Progress from './Progress';

function computeCompleted(s: CaseSnapshot): Record<FlowStep, boolean> {
  return {
    [FlowStep.Start]: !!s.caseId,
    [FlowStep.Questionnaire]: !!s.questionnaire?.lastUpdated,
    [FlowStep.Upload]: (s.documents || []).length > 0,
    [FlowStep.Eligibility]: (s.eligibility || []).length > 0,
    [FlowStep.Summary]: false,
  };
}

function deduceStep(s: CaseSnapshot): FlowStep {
  const comp = computeCompleted(s);
  if (!comp[FlowStep.Start]) return FlowStep.Start;
  if (comp[FlowStep.Eligibility]) return FlowStep.Summary;
  if (comp[FlowStep.Upload]) return FlowStep.Eligibility;
  if (comp[FlowStep.Questionnaire]) return FlowStep.Upload;
  return FlowStep.Questionnaire;
}

export default function Wizard() {
  const { caseId, currentStep, setStep, markDone, completed, reset } = useCaseStore();
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const id = getCaseId(true);
    if (id) {
      loadStatus(id);
    }
  }, []);

  async function loadStatus(id: string) {
    setLoading(true);
    try {
      const res = await getStatus(id);
      setCaseId(res.caseId);
      setSnapshot(res);
      useCaseStore.setState({ completed: computeCompleted(res) });
      setStep(deduceStep(res));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await initCase();
      setCaseId(res.caseId);
      setSnapshot(res);
      useCaseStore.setState({ completed: computeCompleted(res) });
      markDone(FlowStep.Start);
      setStep(FlowStep.Questionnaire);
      setError(undefined);
    } catch (e: any) {
      setError(e.message || 'Failed to start');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionnaireComplete = (snap: CaseSnapshot) => {
    setSnapshot(snap);
    useCaseStore.setState({ completed: computeCompleted(snap) });
    markDone(FlowStep.Questionnaire);
    setStep(FlowStep.Upload);
  };

  const handleUploadNext = () => {
    markDone(FlowStep.Upload);
    setStep(FlowStep.Eligibility);
  };

  const handleEligibilityComplete = (snap: CaseSnapshot) => {
    setSnapshot(snap);
    useCaseStore.setState({ completed: computeCompleted(snap) });
    markDone(FlowStep.Eligibility);
    setStep(FlowStep.Summary);
  };

  const handleRestart = () => {
    reset();
    setSnapshot(null);
    setError(undefined);
  };

  const handleBack = () => {
    setStep((currentStep - 1) as FlowStep);
  };

  if (loading && !snapshot && currentStep === FlowStep.Start) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}
      <Progress current={currentStep} completed={completed} />
      {currentStep === FlowStep.Start && (
        <StartStep onStart={handleStart} loading={loading} />
      )}
      {currentStep === FlowStep.Questionnaire && caseId && (
        <QuestionnaireStep
          caseId={caseId}
          onComplete={handleQuestionnaireComplete}
          onBack={handleBack}
        />
      )}
      {currentStep === FlowStep.Upload && caseId && (
        <UploadStep
          caseId={caseId}
          docs={snapshot?.documents || []}
          onUploaded={(s) => {
            setSnapshot(s);
            useCaseStore.setState({ completed: computeCompleted(s) });
          }}
          onNext={handleUploadNext}
          onBack={handleBack}
        />
      )}
      {currentStep === FlowStep.Eligibility && caseId && (
        <EligibilityStep
          caseId={caseId}
          onComplete={handleEligibilityComplete}
          onBack={handleBack}
        />
      )}
      {currentStep === FlowStep.Summary && snapshot && (
        <SummaryStep snapshot={snapshot} onRestart={handleRestart} />
      )}
    </div>
  );
}

