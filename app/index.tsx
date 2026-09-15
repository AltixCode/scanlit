import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Button, Screen, Text } from "@/components/ui";
import { t } from "@/i18n";
import { classify, isOpenable } from "@/logic/codes";
import { useCodeStore } from "@/store/useCodeStore";
import { useTheme } from "@/theme";

/**
 * The scanner.
 *
 * The camera is mounted only while this screen is showing something to scan, and the frame is
 * never written anywhere — the app has no network calls at all, which is what makes "nothing
 * leaves your phone" a fact rather than a slogan.
 */
export default function Scan() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const record = useCodeStore((s) => s.record);
  const [last, setLast] = useState<string | null>(null);

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (record(data) === "recorded") {
        setLast(data);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    },
    [record],
  );

  const payload = last ? classify(last) : null;

  const copy = useCallback(() => {
    if (!payload) return;
    void Clipboard.setStringAsync(payload.raw);
    Alert.alert(t("copied"));
  }, [payload]);

  const open = useCallback(() => {
    // Only schemes the OS handles, and only on an explicit tap. A scanner that opens whatever
    // it sees is an attack surface pointed at its own user.
    if (payload && isOpenable(payload)) void Linking.openURL(payload.raw);
  }, [payload]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("scanTab")}</Text>
          </View>
          <Button
            label={t("createTab")}
            variant="ghost"
            onPress={() => router.push("/create")}
          />
          <Button
            label={t("historyTab")}
            variant="ghost"
            onPress={() => router.push("/history")}
          />
        </View>

        {!permission?.granted ? (
          <View style={{ marginTop: spacing.xl }}>
            <Text variant="bodyStrong">{t("cameraPermissionTitle")}</Text>
            <Text
              variant="caption"
              tone="muted"
              style={{ marginTop: spacing.xs }}
            >
              {t("cameraPermissionBody")}
            </Text>
            <Button
              label={t("grantCamera")}
              fullWidth
              onPress={() => void requestPermission()}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                marginTop: spacing.md,
                height: 320,
                borderRadius: radius.lg,
                overflow: "hidden",
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "qr",
                    "ean13",
                    "ean8",
                    "code128",
                    "code39",
                    "upc_a",
                    "pdf417",
                  ],
                }}
                onBarcodeScanned={onScanned}
              />
            </View>
            <Text
              variant="caption"
              tone="muted"
              style={{ marginTop: spacing.sm }}
            >
              {t("scanPrompt")}
            </Text>
          </>
        )}

        {payload ? (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.base,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="micro" tone="faint">
              {t("lastScan").toUpperCase()}
            </Text>
            <Text variant="body" style={{ marginTop: spacing.xs }}>
              {payload.label}
            </Text>

            <View
              style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}
            >
              {isOpenable(payload) ? (
                <Button
                  label={t("openCta")}
                  onPress={open}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                label={t("copyCta")}
                variant="secondary"
                onPress={copy}
                style={{ flex: 1 }}
              />
            </View>

            {!isOpenable(payload) ? (
              <Text
                variant="micro"
                tone="faint"
                style={{ marginTop: spacing.sm }}
              >
                {t("notOpenableNote")}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text variant="micro" tone="faint" style={{ marginTop: spacing.lg }}>
          {t("privacyNote")}
        </Text>

        <Button
          label={t("settingsTitle")}
          variant="ghost"
          fullWidth
          onPress={() => router.push("/settings")}
          style={{ marginTop: spacing.md }}
        />
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
});
