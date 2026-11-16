import type { StoredProject } from '../../storage/db';
import type { DemoPackage } from '../open-document/demo-packages';

/**
 * Projects v1 seeds: demo projects authored in code, each opening one bundled demo package.
 * Emails use the reserved `example.com` domain (no real person).
 */
const HOUR = 60 * 60 * 1000;

interface SeedSpec {
  id: string;
  packageId: string;
  name: string;
  description: string;
  members: StoredProject['members'];
  summary: { gate: 'blocked' | 'ready' | 'not_started'; openItems: number; agoHours: number };
}

const SPECS: SeedSpec[] = [
  {
    id: 'seed-northgate-iii',
    packageId: 'northgate-iii',
    name: 'Northgate Capital Fund III',
    description:
      'Subscription documents for the third Northgate fund, checked against the Fund II agreement and the LPA definitions before digitization.',
    members: [
      { name: 'Hannah Crane', email: 'hannah.crane@example.com', role: 'counsel' },
      { name: 'Minh Tran', email: 'minh.tran@example.com', role: 'analyst' },
      { name: 'Priya Shah', email: 'priya.shah@example.com', role: 'approver' },
    ],
    summary: { gate: 'blocked', openItems: 7, agoHours: 2 },
  },
  {
    id: 'seed-lotus-bay-asia-ii',
    packageId: 'lotus-bay-asia-ii',
    name: 'Lotus Bay Asia II',
    description:
      'Asia feeder package with a parallel fund agreement. Counsel answered the open questions; waiting for approval.',
    members: [
      { name: 'Daniel Ostra', email: 'daniel.ostra@example.com', role: 'counsel' },
      { name: 'Linh Pham', email: 'linh.pham@example.com', role: 'analyst' },
      { name: 'Grace Lee', email: 'grace.lee@example.com', role: 'advisor' },
      { name: 'Omar Haddad', email: 'omar.haddad@example.com', role: 'approver' },
    ],
    summary: { gate: 'ready', openItems: 0, agoHours: 26 },
  },
  {
    id: 'seed-redwood-ridge-i',
    packageId: 'redwood-ridge-i',
    name: 'Redwood Ridge Fund I',
    description: 'First close package. Documents received, review not started.',
    members: [
      { name: 'Sara Kim', email: 'sara.kim@example.com', role: 'analyst' },
      { name: 'Tom Becker', email: 'tom.becker@example.com', role: 'approver' },
    ],
    summary: { gate: 'not_started', openItems: 0, agoHours: 72 },
  },
];

/** 2-3 seeded projects for the demo packages that exist in this build. */
export function buildSeedProjects(
  demoPackages: readonly DemoPackage[],
  now: number = Date.now(),
): StoredProject[] {
  const ids = new Set(demoPackages.map((p) => p.id));
  return SPECS.filter((s) => ids.has(s.packageId)).map((s) => {
    const at = now - s.summary.agoHours * HOUR;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      members: s.members.map((m) => ({ ...m })),
      createdAt: at,
      updatedAt: at,
      docIds: [],
      seeded: true,
      demoPackageId: s.packageId,
      summary: { gate: s.summary.gate, openItems: s.summary.openItems, lastActivity: at },
    };
  });
}
