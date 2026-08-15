'use client';

/**
 * The reviewer workspace shell: application chrome, the persistent queue rail,
 * and the record pane.
 *
 * Keeping the rail in the layout (rather than on the queue page) is what makes
 * this a workspace instead of a pair of pages — the queue is fetched once,
 * keeps its scroll position and its filters, and the selected record simply
 * swaps in beside it.
 */
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';

import AuthGate from '@/components/AuthGate';
import QueueProvider from '@/components/QueueProvider';
import QueueRail from '@/components/QueueRail';

export default function ReviewLayout({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const selectedId = segment ? decodeURIComponent(segment) : null;

  return (
    <AuthGate>
      <QueueProvider>
        {/* data-mode drives the narrow-screen behaviour: below 1024px the rail
            and the record take turns rather than squeezing side by side. */}
        <div className="workspace" data-mode={selectedId ? 'record' : 'list'}>
          <QueueRail selectedId={selectedId} />
          <div className="record">{children}</div>
        </div>
      </QueueProvider>
    </AuthGate>
  );
}
