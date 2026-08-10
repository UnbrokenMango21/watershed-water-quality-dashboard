import { useLocalSearchParams } from 'expo-router';

import { useDrafts } from '@/providers/draft-provider';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function useObservationDraft() {
  const params = useLocalSearchParams<{
    submissionId?: string | string[];
    revisionId?: string | string[];
  }>();
  const submissionId = first(params.submissionId) ?? '';
  const revisionId = first(params.revisionId) ?? '';
  const drafts = useDrafts();
  const draft = drafts.getDraft(submissionId, revisionId);

  return {
    ...drafts,
    draft,
    submissionId,
    revisionId,
    routeParams: { submissionId, revisionId },
  };
}
