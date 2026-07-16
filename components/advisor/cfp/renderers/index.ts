import type React from 'react';
import type { CfpSectionType } from '../sectionMeta';
import type { RendererProps } from '../SectionCard';
import InsuranceRenderer from './InsuranceRenderer';
import CashflowRenderer from './CashflowRenderer';
import GoalsRenderer from './GoalsRenderer';
import InvestmentRenderer from './InvestmentRenderer';
import RetirementRenderer from './RetirementRenderer';
import TaxRenderer from './TaxRenderer';
import LegacyRenderer from './LegacyRenderer';
import SynthesisRenderer from './SynthesisRenderer';

// section_type → renderer. A missing entry falls back to SectionCard's raw
// JSON view, so backend modules can ship ahead of their bespoke UI.
export const RENDERERS: Partial<Record<CfpSectionType, React.ComponentType<RendererProps>>> = {
  insurance_planning: InsuranceRenderer,
  cashflow_planning: CashflowRenderer,
  goals_planning: GoalsRenderer,
  investment_planning: InvestmentRenderer,
  retirement_planning: RetirementRenderer,
  tax_planning: TaxRenderer,
  legacy_planning: LegacyRenderer,
  financial_health: SynthesisRenderer,
};
