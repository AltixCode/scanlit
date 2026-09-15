import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import History from '../history';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { FREE_HISTORY, useCodeStore } from '@/store/useCodeStore';
import { usePremiumStore } from '@/store/usePremiumStore';

const entry = (i: number) => ({
  id: `id-${i}`,
  raw: `https://example.com/${i}`,
  kind: 'url' as const,
  at: i,
});

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
  useCodeStore.setState({ history: [], colour: null });
});

describe('the history screen', () => {
  it('says so when nothing has been scanned', async () => {
    const { getByText } = await renderWithProviders(<History />);
    expect(getByText(t('emptyHistory'))).toBeTruthy();
  });

  it('lists a scan with its kind', async () => {
    useCodeStore.setState({ history: [entry(1)] });
    const { getByText } = await renderWithProviders(<History />);
    expect(getByText('https://example.com/1')).toBeTruthy();
    expect(getByText('url')).toBeTruthy();
  });

  it('filters as you search', async () => {
    useCodeStore.setState({ history: [entry(1), entry(2)] });
    const { getByLabelText, queryByText } = await renderWithProviders(<History />);
    await fireEvent.changeText(getByLabelText(t('searchLabel')), '/2');
    expect(queryByText('https://example.com/2')).not.toBeNull();
    expect(queryByText('https://example.com/1')).toBeNull();
  });

  it('removes one entry on tap', async () => {
    useCodeStore.setState({ history: [entry(1)] });
    const { getByText } = await renderWithProviders(<History />);
    await fireEvent.press(getByText('https://example.com/1'));
    expect(useCodeStore.getState().history).toHaveLength(0);
  });

  it('tells a free user exactly how many scans the purchase would show', async () => {
    useCodeStore.setState({
      history: Array.from({ length: FREE_HISTORY + 6 }, (_, i) => entry(i)),
    });
    const { getByText } = await renderWithProviders(<History />);
    expect(getByText(t('moreHistoryLocked', { n: '6' }))).toBeTruthy();
  });

  it('sends that prompt to the paywall', async () => {
    useCodeStore.setState({
      history: Array.from({ length: FREE_HISTORY + 2 }, (_, i) => entry(i)),
    });
    const { getByLabelText } = await renderWithProviders(<History />);
    await fireEvent.press(getByLabelText(t('moreHistoryLocked', { n: '2' })));
    expect(testRouter.push).toHaveBeenCalledWith('/paywall');
  });

  it('shows a paying user everything, with no prompt', async () => {
    usePremiumStore.setState({ isPremium: true });
    useCodeStore.setState({
      history: Array.from({ length: FREE_HISTORY + 6 }, (_, i) => entry(i)),
    });
    const { queryByText } = await renderWithProviders(<History />);
    expect(queryByText(t('moreHistoryLocked', { n: '6' }))).toBeNull();
  });

  it('clears everything on request', async () => {
    useCodeStore.setState({ history: [entry(1), entry(2)] });
    const { getByText } = await renderWithProviders(<History />);
    await fireEvent.press(getByText(t('clearCta')));
    expect(useCodeStore.getState().history).toHaveLength(0);
  });
});
