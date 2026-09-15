import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { QrView } from '@/components/QrView';
import { Button, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { bestLevelFor, qrMatrix } from '@/logic/codes';
import { useCodeStore } from '@/store/useCodeStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { CODE_COLOURS, CODE_QUIET_ZONE } from '@/theme/codeColours';
import { contrastRatio, useTheme } from '@/theme';

const MIN_TOUCH_TARGET = 44;
/** Below this a coloured code stops reading reliably against white. */
const MIN_CODE_CONTRAST = 4.5;

export default function Create() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const colour = useCodeStore((s) => s.colour);
  const setColour = useCodeStore((s) => s.setColour);
  const splitBatch = useCodeStore((s) => s.splitBatch);

  const [text, setText] = useState('');
  const [matrices, setMatrices] = useState<{ text: string; matrix: boolean[][] }[]>([]);

  const lines = useMemo(() => splitBatch(text, isPremium), [splitBatch, text, isPremium]);

  // Encoding is async and the input changes on every keystroke. Everything, including the
  // empty case, is set from inside the async body: a synchronous setState in an effect is
  // what the React Compiler's cascading-render rule is there to catch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const built: { text: string; matrix: boolean[][] }[] = [];
      for (const line of lines) {
        try {
          const level = await bestLevelFor(line, false);
          built.push({ text: line, matrix: await qrMatrix(line, level) });
        } catch {
          // A line that cannot be encoded is skipped rather than rendering a broken code.
        }
      }
      // A stale result must never overwrite a newer one.
      if (!cancelled) setMatrices(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const pickColour = useCallback(
    (value: string | null) => {
      if (setColour(value, isPremium) === 'locked') {
        Alert.alert(t('lockedTitle'), t('unlockBody'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('removeAdsCta'), onPress: () => router.push('/paywall') },
        ]);
      }
    },
    [setColour, isPremium, router],
  );

  const copy = useCallback(() => {
    if (!text.trim()) return;
    void Clipboard.setStringAsync(text.trim());
    Alert.alert(t('copied'));
  }, [text]);

  // A pale code on white does not scan. Saying so is more use than letting someone print it.
  const tooLight =
    colour !== null && contrastRatio(colour, CODE_QUIET_ZONE) < MIN_CODE_CONTRAST;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <Text variant="micro" tone="faint">
          {t('createLabel').toUpperCase()}
        </Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('batchHint')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('createLabel')}
          style={{
            minHeight: 96,
            marginTop: spacing.xs,
            color: colors.text,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        />

        {!isPremium ? (
          <Text variant="micro" tone="faint" style={{ marginTop: spacing.xs }}>
            {t('batchLockedNote')}
          </Text>
        ) : null}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.lg }}>
          {t('colourLabel').toUpperCase()}
        </Text>
        <View style={[styles.chips, { gap: spacing.sm, marginTop: spacing.xs }]}>
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={t('colourDefault')}
            accessibilityState={{ selected: colour === null }}
            onPress={() => pickColour(null)}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
              paddingHorizontal: spacing.base,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceAlt,
              borderWidth: colour === null ? 2 : 1,
              borderColor: colour === null ? colors.accent : colors.border,
            }}
          >
            <Text variant="caption">{t('colourDefault')}</Text>
          </Pressable>

          {CODE_COLOURS.map((option) => {
            const locked = !isPremium;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={
                  locked ? `${option.name} — ${t('lockedTitle')}` : option.name
                }
                accessibilityState={{ selected: colour === option.value }}
                onPress={() => pickColour(option.value)}
                style={{
                  width: MIN_TOUCH_TARGET,
                  height: MIN_TOUCH_TARGET,
                  borderRadius: radius.full,
                  backgroundColor: option.value,
                  borderWidth: colour === option.value ? 3 : 1,
                  borderColor: colour === option.value ? colors.accent : colors.border,
                  opacity: locked ? 0.6 : 1,
                }}
              />
            );
          })}
        </View>

        {tooLight ? (
          <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>
            {t('contrastWarning')}
          </Text>
        ) : null}

        {matrices.map(({ text: line, matrix }) => (
          <View key={line} style={{ alignItems: 'center', marginTop: spacing.lg }}>
            <View accessible accessibilityLabel={t('codeFor', { text: line })}>
              <QrView matrix={matrix} size={220} colour={colour} />
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {line}
            </Text>
          </View>
        ))}

        {text.trim() ? (
          <Button
            label={t('copyCta')}
            variant="secondary"
            fullWidth
            onPress={copy}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.lg }}>
          {t('privacyNote')}
        </Text>
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
