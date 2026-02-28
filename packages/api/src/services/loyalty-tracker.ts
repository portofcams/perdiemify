/**
 * Loyalty Tracker — Phase 3
 *
 * Handles:
 * - Points valuation seeding & sync (curated data from public sources)
 * - Earning rate engine (points per dollar by program)
 * - Credit card recommendation engine
 * - Booking → loyalty point accumulation
 * - Elite status tier calculations
 */

import { db } from '../db';
import { loyaltyValuations, loyaltyAccounts, users } from '../db/schema';
import { sql, eq } from 'drizzle-orm';

// ─── Points Valuations (curated from public sources like TPG, NerdWallet) ──

export interface ProgramValuation {
  programName: string;
  pointValueCents: number; // cents per point
  bestRedemptionType: string;
  source: string;
  earningRate: number; // base points per dollar spent
  eliteTiers: EliteTier[];
  transferPartners?: string[];
}

export interface EliteTier {
  name: string;
  threshold: number; // nights/flights/points needed
  multiplier: number; // earning bonus (e.g., 1.5x)
  perks: string[];
}

// Curated valuation data — updated from public sources (TPG, NerdWallet, Bankrate)
// These are approximate average redemption values as of 2026
export const PROGRAM_VALUATIONS: ProgramValuation[] = [
  // Airlines
  {
    programName: 'Delta SkyMiles',
    pointValueCents: 1.2,
    bestRedemptionType: 'Domestic economy flights',
    source: 'Market consensus 2026',
    earningRate: 5, // 5 miles per dollar
    eliteTiers: [
      { name: 'Silver', threshold: 25000, multiplier: 1.4, perks: ['Complimentary upgrades', 'Priority boarding'] },
      { name: 'Gold', threshold: 50000, multiplier: 1.6, perks: ['Sky Priority', 'Lounge access on intl'] },
      { name: 'Platinum', threshold: 75000, multiplier: 1.8, perks: ['Choice benefits', 'Complimentary upgrades'] },
      { name: 'Diamond', threshold: 125000, multiplier: 2.0, perks: ['Delta Sky Club', 'Global upgrades'] },
    ],
    transferPartners: ['Virgin Atlantic', 'Air France/KLM', 'Korean Air'],
  },
  {
    programName: 'United MileagePlus',
    pointValueCents: 1.3,
    bestRedemptionType: 'Partner award flights',
    source: 'Market consensus 2026',
    earningRate: 5,
    eliteTiers: [
      { name: 'Silver', threshold: 12, multiplier: 1.4, perks: ['Economy Plus at check-in', 'Priority boarding'] },
      { name: 'Gold', threshold: 24, multiplier: 1.6, perks: ['Star Alliance Gold', 'Lounge access'] },
      { name: 'Platinum', threshold: 48, multiplier: 1.8, perks: ['Complimentary upgrades', 'Economy Plus'] },
      { name: '1K', threshold: 54, multiplier: 2.0, perks: ['Global Premier Upgrades', 'United Club access'] },
    ],
    transferPartners: ['ANA', 'Lufthansa', 'Singapore Airlines'],
  },
  {
    programName: 'American AAdvantage',
    pointValueCents: 1.4,
    bestRedemptionType: 'Off-peak partner awards',
    source: 'Market consensus 2026',
    earningRate: 5,
    eliteTiers: [
      { name: 'Gold', threshold: 25000, multiplier: 1.4, perks: ['Priority boarding', 'Same-day standby'] },
      { name: 'Platinum', threshold: 50000, multiplier: 1.6, perks: ['Complimentary upgrades', 'MCE seating'] },
      { name: 'Platinum Pro', threshold: 75000, multiplier: 1.8, perks: ['500-mile upgrades', 'Systemwide upgrades'] },
      { name: 'Executive Platinum', threshold: 100000, multiplier: 2.0, perks: ['Admirals Club', 'Confirmed upgrades'] },
    ],
    transferPartners: ['British Airways', 'Qantas', 'Cathay Pacific'],
  },
  {
    programName: 'Southwest Rapid Rewards',
    pointValueCents: 1.4,
    bestRedemptionType: 'Wanna Get Away fares',
    source: 'Market consensus 2026',
    earningRate: 6,
    eliteTiers: [
      { name: 'A-List', threshold: 25000, multiplier: 1.25, perks: ['Priority boarding', 'Same-day standby'] },
      { name: 'A-List Preferred', threshold: 50000, multiplier: 2.0, perks: ['Free WiFi', 'Bonus points'] },
      { name: 'Companion Pass', threshold: 125000, multiplier: 1.0, perks: ['Free companion on all flights'] },
    ],
  },
  {
    programName: 'JetBlue TrueBlue',
    pointValueCents: 1.3,
    bestRedemptionType: 'Blue Basic fares',
    source: 'Market consensus 2026',
    earningRate: 3,
    eliteTiers: [
      { name: 'Mosaic', threshold: 15000, multiplier: 1.5, perks: ['Free checked bags', 'Even More Space', 'Priority boarding'] },
    ],
  },
  {
    programName: 'Alaska Mileage Plan',
    pointValueCents: 1.5,
    bestRedemptionType: 'Partner first/business class',
    source: 'Market consensus 2026',
    earningRate: 5,
    eliteTiers: [
      { name: 'MVP', threshold: 20000, multiplier: 1.5, perks: ['Preferred seating', 'Priority boarding'] },
      { name: 'MVP Gold', threshold: 40000, multiplier: 2.0, perks: ['Complimentary upgrades', 'Lounge access'] },
      { name: 'MVP Gold 75K', threshold: 75000, multiplier: 2.0, perks: ['4 upgrades', 'International lounge'] },
    ],
    transferPartners: ['Cathay Pacific', 'Emirates', 'Qantas'],
  },

  // Hotels
  {
    programName: 'Marriott Bonvoy',
    pointValueCents: 0.7,
    bestRedemptionType: 'Off-peak Category 1-4 hotels',
    source: 'Market consensus 2026',
    earningRate: 10, // 10 points per dollar at Marriott
    eliteTiers: [
      { name: 'Silver', threshold: 10, multiplier: 1.0, perks: ['Priority late checkout'] },
      { name: 'Gold', threshold: 25, multiplier: 1.25, perks: ['Room upgrade', 'Enhanced WiFi', '2pm checkout'] },
      { name: 'Platinum', threshold: 50, multiplier: 1.5, perks: ['Suite upgrade', 'Lounge access', 'Welcome gift'] },
      { name: 'Titanium', threshold: 75, multiplier: 1.75, perks: ['48hr guarantee', 'United Silver'] },
      { name: 'Ambassador', threshold: 100, multiplier: 2.0, perks: ['Personal ambassador', 'Your24 check-in'] },
    ],
    transferPartners: ['United', 'Delta', 'American'],
  },
  {
    programName: 'Hilton Honors',
    pointValueCents: 0.5,
    bestRedemptionType: 'Standard room redemptions',
    source: 'Market consensus 2026',
    earningRate: 10,
    eliteTiers: [
      { name: 'Silver', threshold: 10, multiplier: 1.2, perks: ['5th night free', 'Digital key'] },
      { name: 'Gold', threshold: 20, multiplier: 1.5, perks: ['Room upgrade', 'Free breakfast', 'Late checkout'] },
      { name: 'Diamond', threshold: 30, multiplier: 2.0, perks: ['Executive lounge', 'Suite upgrade', '48hr guarantee'] },
    ],
    transferPartners: ['American Airlines', 'Virgin Atlantic'],
  },
  {
    programName: 'IHG One Rewards',
    pointValueCents: 0.5,
    bestRedemptionType: 'PointBreaks list hotels',
    source: 'Market consensus 2026',
    earningRate: 10,
    eliteTiers: [
      { name: 'Silver', threshold: 10, multiplier: 1.2, perks: ['Late checkout', 'Free internet'] },
      { name: 'Gold', threshold: 20, multiplier: 1.4, perks: ['Room upgrade', 'Welcome amenity'] },
      { name: 'Platinum', threshold: 40, multiplier: 1.6, perks: ['Guaranteed room', 'Best rate guarantee'] },
      { name: 'Diamond', threshold: 70, multiplier: 2.0, perks: ['Suite upgrade', 'Milestone bonuses'] },
    ],
  },
  {
    programName: 'World of Hyatt',
    pointValueCents: 1.7,
    bestRedemptionType: 'Category 1-3 hotels',
    source: 'Market consensus 2026',
    earningRate: 5,
    eliteTiers: [
      { name: 'Discoverist', threshold: 10, multiplier: 1.1, perks: ['Preferred rooms', 'Late checkout'] },
      { name: 'Explorist', threshold: 30, multiplier: 1.3, perks: ['Room upgrade', 'Free parking'] },
      { name: 'Globalist', threshold: 60, multiplier: 1.5, perks: ['Suite upgrade', 'Free breakfast', 'Club access', 'Guest of Honor'] },
    ],
    transferPartners: ['American Airlines'],
  },
  {
    programName: 'Wyndham Rewards',
    pointValueCents: 0.7,
    bestRedemptionType: 'Go Free nights (15k/30k)',
    source: 'Market consensus 2026',
    earningRate: 10,
    eliteTiers: [
      { name: 'Gold', threshold: 5, multiplier: 1.0, perks: ['Best rate guarantee', 'Free WiFi'] },
      { name: 'Platinum', threshold: 15, multiplier: 1.5, perks: ['Late checkout', 'Room upgrade'] },
      { name: 'Diamond', threshold: 40, multiplier: 2.0, perks: ['Suite upgrade', 'Welcome amenity'] },
    ],
  },
  {
    programName: 'Choice Privileges',
    pointValueCents: 0.6,
    bestRedemptionType: 'Standard room nights',
    source: 'Market consensus 2026',
    earningRate: 10,
    eliteTiers: [
      { name: 'Gold', threshold: 10, multiplier: 1.25, perks: ['Early check-in', 'Late checkout'] },
      { name: 'Platinum', threshold: 20, multiplier: 1.5, perks: ['Bonus points', 'Welcome gift'] },
      { name: 'Diamond', threshold: 30, multiplier: 2.0, perks: ['Suite upgrade', 'Guaranteed room'] },
    ],
  },
  {
    programName: 'Best Western Rewards',
    pointValueCents: 0.6,
    bestRedemptionType: 'Free night stays',
    source: 'Market consensus 2026',
    earningRate: 10,
    eliteTiers: [
      { name: 'Gold', threshold: 10, multiplier: 1.1, perks: ['Bonus points', 'Late checkout'] },
      { name: 'Platinum', threshold: 15, multiplier: 1.25, perks: ['Room upgrade', 'Welcome gift'] },
      { name: 'Diamond', threshold: 30, multiplier: 1.5, perks: ['Suite upgrade', 'Complimentary breakfast'] },
    ],
  },

  // Car Rental
  {
    programName: 'National Emerald Club',
    pointValueCents: 0.8,
    bestRedemptionType: 'Free rental days',
    source: 'Market consensus 2026',
    earningRate: 1, // 1 credit per rental
    eliteTiers: [
      { name: 'Emerald Club', threshold: 0, multiplier: 1.0, perks: ['Aisle selection', 'Counter bypass'] },
      { name: 'Executive', threshold: 12, multiplier: 1.5, perks: ['One Car Class upgrade', 'Guaranteed availability'] },
      { name: 'Executive Elite', threshold: 25, multiplier: 2.0, perks: ['Two Car Class upgrades', 'Free additional driver'] },
    ],
  },
  {
    programName: 'Hertz Gold Plus',
    pointValueCents: 0.7,
    bestRedemptionType: 'Free rental days',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [
      { name: 'Gold', threshold: 0, multiplier: 1.0, perks: ['Skip the counter', 'Points earning'] },
      { name: 'Five Star', threshold: 10, multiplier: 1.25, perks: ['Car class upgrade', 'Bonus points'] },
      { name: 'President\'s Circle', threshold: 20, multiplier: 1.5, perks: ['Guaranteed availability', 'Premium upgrades'] },
    ],
  },
  {
    programName: 'Avis Preferred',
    pointValueCents: 0.5,
    bestRedemptionType: 'Free rental days',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [
      { name: 'Preferred', threshold: 0, multiplier: 1.0, perks: ['Skip the counter', 'Choose your car'] },
      { name: 'Preferred Plus', threshold: 12, multiplier: 1.5, perks: ['Free upgrade', 'Weekend specials'] },
    ],
  },
  {
    programName: 'Enterprise Plus',
    pointValueCents: 0.5,
    bestRedemptionType: 'Free rental days',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [
      { name: 'Plus', threshold: 0, multiplier: 1.0, perks: ['Points earning', 'Skip the counter'] },
      { name: 'Silver', threshold: 12, multiplier: 1.25, perks: ['Car class upgrade', 'Bonus points'] },
      { name: 'Gold', threshold: 24, multiplier: 1.5, perks: ['Premium upgrades', 'Guaranteed availability'] },
    ],
  },

  // Credit Card Transfer Programs
  {
    programName: 'Chase Ultimate Rewards',
    pointValueCents: 2.0,
    bestRedemptionType: 'Transfer to Hyatt',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [],
    transferPartners: ['United', 'Southwest', 'World of Hyatt', 'Marriott', 'IHG', 'British Airways', 'Air France/KLM'],
  },
  {
    programName: 'Amex Membership Rewards',
    pointValueCents: 2.0,
    bestRedemptionType: 'Transfer to airline partners',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [],
    transferPartners: ['Delta', 'ANA', 'Singapore Airlines', 'Hilton', 'Marriott', 'British Airways'],
  },
  {
    programName: 'Citi ThankYou',
    pointValueCents: 1.7,
    bestRedemptionType: 'Transfer to airline partners',
    source: 'Market consensus 2026',
    earningRate: 1,
    eliteTiers: [],
    transferPartners: ['JetBlue', 'Turkish Airlines', 'Singapore Airlines', 'Air France/KLM', 'Qatar Airways'],
  },
  {
    programName: 'Capital One Miles',
    pointValueCents: 1.7,
    bestRedemptionType: 'Transfer to airline partners',
    source: 'Market consensus 2026',
    earningRate: 2,
    eliteTiers: [],
    transferPartners: ['Turkish Airlines', 'Air Canada', 'British Airways', 'Qantas', 'Wyndham'],
  },
];

// ─── Seed / Sync Valuations ──────────────────────────────────────

export async function syncLoyaltyValuations(): Promise<{ synced: number }> {
  let synced = 0;

  for (const program of PROGRAM_VALUATIONS) {
    try {
      await db.execute(sql`
        INSERT INTO loyalty_valuations (id, program_name, point_value_cents, best_redemption_type, source, updated_at)
        VALUES (gen_random_uuid(), ${program.programName}, ${program.pointValueCents}, ${program.bestRedemptionType}, ${program.source}, NOW())
        ON CONFLICT (program_name) DO UPDATE SET
          point_value_cents = ${program.pointValueCents},
          best_redemption_type = ${program.bestRedemptionType},
          source = ${program.source},
          updated_at = NOW()
      `);
      synced++;
    } catch (err) {
      console.warn(`Failed to sync valuation for ${program.programName}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[LoyaltyTracker] Synced ${synced}/${PROGRAM_VALUATIONS.length} program valuations`);
  return { synced };
}

// ─── Earning Rate Engine ─────────────────────────────────────────

export function getEarningRate(programName: string): number {
  const program = PROGRAM_VALUATIONS.find(p => p.programName === programName);
  return program?.earningRate ?? 5; // default 5 points per dollar
}

export function estimatePointsEarned(
  programName: string,
  amountUsd: number,
  statusLevel?: string
): { points: number; valueCents: number } {
  const program = PROGRAM_VALUATIONS.find(p => p.programName === programName);
  if (!program) {
    return { points: Math.round(amountUsd * 5), valueCents: Math.round(amountUsd * 5 * 1.0) };
  }

  // Find status multiplier
  let multiplier = 1.0;
  if (statusLevel && program.eliteTiers.length > 0) {
    const tier = program.eliteTiers.find(t =>
      t.name.toLowerCase() === statusLevel.toLowerCase()
    );
    if (tier) multiplier = tier.multiplier;
  }

  const basePoints = Math.round(amountUsd * program.earningRate);
  const earnedPoints = Math.round(basePoints * multiplier);
  const valueCents = Math.round(earnedPoints * program.pointValueCents);

  return { points: earnedPoints, valueCents };
}

// ─── Credit Card Recommendation Engine ───────────────────────────

export interface CardRecommendation {
  cardProgram: string;
  transferTo: string;
  pointsEarned: number;
  estimatedValue: number; // USD
  strategy: string;
}

export function recommendCreditCard(
  bookingType: 'hotel' | 'flight' | 'car',
  provider: string,
  amountUsd: number
): CardRecommendation[] {
  const recommendations: CardRecommendation[] = [];

  // Find the loyalty program for this provider
  const providerProgram = detectLoyaltyProgram(provider, bookingType);

  // For each credit card program, calculate value
  const cardPrograms = PROGRAM_VALUATIONS.filter(p =>
    p.transferPartners && p.transferPartners.length > 0
  );

  for (const card of cardPrograms) {
    // Direct earning
    const directPoints = Math.round(amountUsd * card.earningRate);
    const directValue = Math.round(directPoints * card.pointValueCents) / 100;

    // Check if card can transfer to the hotel/airline program
    let bestTransfer = '';
    let bestTransferValue = directValue;

    if (providerProgram && card.transferPartners) {
      for (const partner of card.transferPartners) {
        if (partner.toLowerCase().includes(providerProgram.toLowerCase()) ||
            providerProgram.toLowerCase().includes(partner.toLowerCase())) {
          const transferProgram = PROGRAM_VALUATIONS.find(p =>
            p.programName.toLowerCase().includes(partner.toLowerCase())
          );
          if (transferProgram) {
            const transferValue = Math.round(directPoints * transferProgram.pointValueCents) / 100;
            if (transferValue > bestTransferValue) {
              bestTransferValue = transferValue;
              bestTransfer = transferProgram.programName;
            }
          }
        }
      }
    }

    let strategy: string;
    if (bestTransfer) {
      strategy = `Earn ${directPoints} ${card.programName} points → transfer to ${bestTransfer} for ~$${bestTransferValue.toFixed(2)} value`;
    } else {
      strategy = `Earn ${directPoints} ${card.programName} points worth ~$${directValue.toFixed(2)}`;
    }

    recommendations.push({
      cardProgram: card.programName,
      transferTo: bestTransfer || 'Direct redemption',
      pointsEarned: directPoints,
      estimatedValue: bestTransferValue,
      strategy,
    });
  }

  // Sort by highest estimated value
  recommendations.sort((a, b) => b.estimatedValue - a.estimatedValue);

  return recommendations;
}

// ─── Loyalty Program Detection ───────────────────────────────────

function detectLoyaltyProgram(provider: string, type: 'hotel' | 'flight' | 'car'): string | null {
  const lp = provider.toLowerCase();

  if (type === 'hotel') {
    if (lp.includes('marriott') || lp.includes('courtyard') || lp.includes('fairfield') || lp.includes('sheraton') || lp.includes('westin') || lp.includes('ritz')) return 'Marriott Bonvoy';
    if (lp.includes('hilton') || lp.includes('hampton') || lp.includes('doubletree') || lp.includes('embassy') || lp.includes('waldorf')) return 'Hilton Honors';
    if (lp.includes('ihg') || lp.includes('holiday inn') || lp.includes('crowne') || lp.includes('intercontinental') || lp.includes('kimpton')) return 'IHG One Rewards';
    if (lp.includes('hyatt')) return 'World of Hyatt';
    if (lp.includes('wyndham') || lp.includes('la quinta') || lp.includes('days inn') || lp.includes('ramada')) return 'Wyndham Rewards';
    if (lp.includes('choice') || lp.includes('comfort') || lp.includes('quality inn')) return 'Choice Privileges';
    if (lp.includes('best western')) return 'Best Western Rewards';
  }

  if (type === 'flight') {
    if (lp.includes('delta')) return 'Delta SkyMiles';
    if (lp.includes('united')) return 'United MileagePlus';
    if (lp.includes('american')) return 'American AAdvantage';
    if (lp.includes('southwest')) return 'Southwest Rapid Rewards';
    if (lp.includes('jetblue')) return 'JetBlue TrueBlue';
    if (lp.includes('alaska')) return 'Alaska Mileage Plan';
  }

  if (type === 'car') {
    if (lp.includes('national')) return 'National Emerald Club';
    if (lp.includes('hertz')) return 'Hertz Gold Plus';
    if (lp.includes('avis')) return 'Avis Preferred';
    if (lp.includes('enterprise')) return 'Enterprise Plus';
  }

  return null;
}

// ─── Elite Status Helpers ────────────────────────────────────────

export interface StatusProgress {
  currentTier: string;
  nextTier: string | null;
  currentProgress: number; // nights/flights/points
  nextTierThreshold: number;
  percentComplete: number;
  perks: string[];
  multiplier: number;
}

export function getStatusProgress(
  programName: string,
  statusLevel: string | null,
  statusProgress: number
): StatusProgress | null {
  const program = PROGRAM_VALUATIONS.find(p => p.programName === programName);
  if (!program || program.eliteTiers.length === 0) return null;

  // Find current tier
  const currentTierIdx = statusLevel
    ? program.eliteTiers.findIndex(t => t.name.toLowerCase() === statusLevel.toLowerCase())
    : -1;

  const currentTier = currentTierIdx >= 0 ? program.eliteTiers[currentTierIdx] : null;
  const nextTier = currentTierIdx < program.eliteTiers.length - 1
    ? program.eliteTiers[currentTierIdx + 1]
    : null;

  const targetThreshold = nextTier?.threshold ?? currentTier?.threshold ?? program.eliteTiers[0].threshold;
  const pctComplete = Math.min(100, Math.round((statusProgress / targetThreshold) * 100));

  return {
    currentTier: currentTier?.name ?? 'Member',
    nextTier: nextTier?.name ?? null,
    currentProgress: statusProgress,
    nextTierThreshold: targetThreshold,
    percentComplete: pctComplete,
    perks: currentTier?.perks ?? [],
    multiplier: currentTier?.multiplier ?? 1.0,
  };
}

// ─── Get Full Program Details ────────────────────────────────────

export function getProgramDetails(programName: string): ProgramValuation | null {
  return PROGRAM_VALUATIONS.find(p => p.programName === programName) ?? null;
}
