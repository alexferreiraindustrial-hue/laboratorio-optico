import { STEP_KEYS, STEP_LABEL, type StepKey, type StepStatus } from "./constants";

export type StepSnapshot = {
  key: StepKey;
  status: StepStatus;
};

export function stepIndex(key: StepKey) {
  return STEP_KEYS.indexOf(key);
}

export function canStartStep(steps: StepSnapshot[], key: StepKey) {
  const current = steps.find((step) => step.key === key);
  if (!current) return false;
  if (current.status === "concluida" || current.status === "em_andamento") return false;
  const index = stepIndex(key);
  if (index === 0) return current.status === "pendente" || current.status === "reprovada";
  const previous = steps.find((step) => step.key === STEP_KEYS[index - 1]);
  return previous?.status === "concluida";
}

export function canCompleteStep(steps: StepSnapshot[], key: StepKey) {
  const current = steps.find((step) => step.key === key);
  if (!current) return false;
  if (current.status === "concluida") return false;
  if (current.status === "em_andamento") return true;
  return canStartStep(steps, key);
}

export function prontoBlockers(input: {
  steps: StepSnapshot[];
  openOccurrences: number;
}): string[] {
  const reasons: string[] = [];
  for (const key of STEP_KEYS) {
    const step = input.steps.find((item) => item.key === key);
    if (!step || step.status !== "concluida") {
      reasons.push(`${STEP_LABEL[key]} ainda não foi concluída.`);
    }
  }
  if (input.openOccurrences > 0) {
    reasons.push("Há ocorrência de qualidade aberta ou em tratamento.");
  }
  return reasons;
}

export function stepsAfterReopen(steps: StepSnapshot[], key: StepKey): StepSnapshot[] {
  const index = stepIndex(key);
  return steps.map((step) => {
    const position = stepIndex(step.key);
    if (position < index) return step;
    if (position === index || step.status !== "pendente") {
      return { ...step, status: "pendente" as const };
    }
    return step;
  });
}
