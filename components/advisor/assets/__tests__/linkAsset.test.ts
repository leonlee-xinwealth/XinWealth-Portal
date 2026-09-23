import { describe, expect, it } from 'vitest';
import { defaultLinkedAssetId } from '../linkAsset';

const asset = (id: string, asset_type: string) => ({ id, asset_type });

describe('defaultLinkedAssetId', () => {
  it('preselects the only vehicle for a car_loan', () => {
    const assets = [asset('a1', 'vehicle'), asset('a2', 'savings')];
    expect(defaultLinkedAssetId('car_loan', assets)).toBe('a1');
  });

  it('does not preselect when there are multiple vehicles', () => {
    const assets = [asset('a1', 'vehicle'), asset('a2', 'vehicle')];
    expect(defaultLinkedAssetId('car_loan', assets)).toBeNull();
  });

  it('does not preselect when there is no vehicle', () => {
    expect(defaultLinkedAssetId('car_loan', [asset('a1', 'savings')])).toBeNull();
  });

  it('preselects the only own_residence for a mortgage', () => {
    const assets = [asset('a1', 'own_residence'), asset('a2', 'savings')];
    expect(defaultLinkedAssetId('mortgage', assets)).toBe('a1');
  });

  it('preselects the only investment_property for a mortgage', () => {
    const assets = [asset('a1', 'investment_property')];
    expect(defaultLinkedAssetId('mortgage', assets)).toBe('a1');
  });

  it('does not preselect a mortgage when both own_residence and investment_property exist', () => {
    const assets = [asset('a1', 'own_residence'), asset('a2', 'investment_property')];
    expect(defaultLinkedAssetId('mortgage', assets)).toBeNull();
  });

  it('does not preselect for liability types with no obvious asset class', () => {
    expect(defaultLinkedAssetId('personal_loan', [asset('a1', 'vehicle')])).toBeNull();
  });

  it('tolerates null/undefined inputs', () => {
    expect(defaultLinkedAssetId(null, null)).toBeNull();
    expect(defaultLinkedAssetId('car_loan', null)).toBeNull();
    expect(defaultLinkedAssetId(undefined, [])).toBeNull();
  });
});
