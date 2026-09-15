import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { Button, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { classify, summarise } from '@/logic/codes';
import { useCodeStore } from '@/store/useCodeStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { useTheme } from '@/theme';

const MIN_TOUCH_TARGET = 44;

export default function History() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const all = useCodeStore((s) => s.history);
  const search = useCodeStore((s) => s.search);
  const remove = useCodeStore((s) => s.remove);
  const clear = useCodeStore((s) => s.clear);
  const exportHistory = useCodeStore((s) => s.exportHistory);

  const [query, setQuery] = useState('');
  const rows = search(query, isPremium);
  const hidden = all.length - useCodeStore.getState().visible(isPremium).length;

  const doExport = useCallback(() => {
    const text = exportHistory();
    if (!text) return;
    void Clipboard.setStringAsync(text);
    Alert.alert(t('copied'));
  }, [exportHistory]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }} />
          {all.length > 0 ? (
            <>
              <Button label={t('exportCta')} variant="ghost" onPress={doExport} />
              <Button label={t('clearCta')} variant="ghost" onPress={clear} />
            </>
          ) : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('searchLabel')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('searchLabel')}
          style={{
            minHeight: MIN_TOUCH_TARGET,
            marginTop: spacing.sm,
            color: colors.text,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          }}
        />

        {rows.length === 0 ? (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
            {t('emptyHistory')}
          </Text>
        ) : (
          rows.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={summarise(classify(entry.raw))}
              onPress={() => remove(entry.id)}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                marginTop: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text variant="body">{summarise(classify(entry.raw))}</Text>
              <Text variant="micro" tone="faint" style={{ marginTop: 2 }}>
                {entry.kind}
              </Text>
            </Pressable>
          ))
        )}

        {hidden > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('moreHistoryLocked', { n: String(hidden) })}
            onPress={() => router.push('/paywall')}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
              paddingHorizontal: spacing.base,
              marginTop: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="caption" tone="accent">
              {t('moreHistoryLocked', { n: String(hidden) })}
            </Text>
          </Pressable>
        ) : null}
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
});
