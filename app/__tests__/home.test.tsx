import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import Home from '../index';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { useCodeStore } from '@/store/useCodeStore';
import { usePremiumStore } from '@/store/usePremiumStore';

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
  useCodeStore.setState({ history: [], colour: null });
});

describe('the scanner screen', () => {
  it('explains why the camera is needed before asking for it', async () => {
    // Asking for a camera with no explanation is how a permission prompt gets declined.
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('cameraPermissionTitle'))).toBeTruthy();
    expect(getByText(t('cameraPermissionBody'))).toBeTruthy();
    expect(getByText(t('grantCamera'))).toBeTruthy();
  });

  it('states plainly that nothing is uploaded', async () => {
    // The tagline makes this claim, so the screen has to carry it too.
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('privacyNote'))).toBeTruthy();
  });

  it('routes to create, history and settings', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('createTab')));
    expect(testRouter.push).toHaveBeenCalledWith('/create');
    await fireEvent.press(getByText(t('historyTab')));
    expect(testRouter.push).toHaveBeenCalledWith('/history');
    await fireEvent.press(getByText(t('settingsTitle')));
    expect(testRouter.push).toHaveBeenCalledWith('/settings');
  });
});
