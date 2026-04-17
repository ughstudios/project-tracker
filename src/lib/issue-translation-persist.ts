import {
  isTranslationConfigured,
  translateIssueContent,
} from "@/lib/issue-content-translation";
import { prisma } from "@/lib/prisma";

export type IssueTranslationListPatch = {
  id: string;
  title: string;
  titleTranslated: string | null;
  symptom: string;
  symptomTranslated: string | null;
  cause: string;
  causeTranslated: string | null;
  solution: string;
  solutionTranslated: string | null;
  contentLanguage: string | null;
};

const listSelect = {
  id: true,
  title: true,
  titleTranslated: true,
  symptom: true,
  symptomTranslated: true,
  cause: true,
  causeTranslated: true,
  solution: true,
  solutionTranslated: true,
  contentLanguage: true,
} as const;

function hasUsableTranslation(t: {
  titleTranslated: string | null;
  symptomTranslated: string | null;
  causeTranslated: string | null;
  solutionTranslated: string | null;
}) {
  return Boolean(
    t.titleTranslated?.trim() ||
      t.symptomTranslated?.trim() ||
      t.causeTranslated?.trim() ||
      t.solutionTranslated?.trim(),
  );
}

/**
 * Calls the translation model and writes results to the issue row (DB cache).
 * Returns updated list fields, or null if nothing changed / AI not configured.
 */
export async function persistIssueTranslations(
  issueId: string,
): Promise<IssueTranslationListPatch | null> {
  if (!isTranslationConfigured()) return null;

  const row = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      title: true,
      titleTranslated: true,
      symptom: true,
      symptomTranslated: true,
      cause: true,
      causeTranslated: true,
      solution: true,
      solutionTranslated: true,
      contentLanguage: true,
    },
  });
  if (!row) return null;

  const translated = await translateIssueContent({
    title: row.title,
    symptom: row.symptom,
    cause: row.cause,
    solution: row.solution,
  });

  const langChanged =
    translated.contentLanguage != null && translated.contentLanguage !== row.contentLanguage;
  const gotText = hasUsableTranslation(translated);

  if (!gotText) {
    if (!langChanged) return null;
    const updated = await prisma.issue.update({
      where: { id: issueId },
      data: { contentLanguage: translated.contentLanguage },
      select: listSelect,
    });
    return updated;
  }

  const same =
    row.titleTranslated === translated.titleTranslated &&
    row.symptomTranslated === translated.symptomTranslated &&
    row.causeTranslated === translated.causeTranslated &&
    row.solutionTranslated === translated.solutionTranslated &&
    row.contentLanguage === translated.contentLanguage;

  if (same) return null;

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      titleTranslated: translated.titleTranslated,
      symptomTranslated: translated.symptomTranslated,
      causeTranslated: translated.causeTranslated,
      solutionTranslated: translated.solutionTranslated,
      contentLanguage: translated.contentLanguage,
    },
    select: listSelect,
  });

  return updated;
}
