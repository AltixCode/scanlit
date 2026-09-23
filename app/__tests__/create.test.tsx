import { fireEvent, waitFor } from "@testing-library/react-native";
import * as MediaLibrary from "expo-media-library/legacy";
import React from "react";
import { Alert } from "react-native";
import { captureRef } from "react-native-view-shot";

import Create from "../create";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useCodeStore } from "@/store/useCodeStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { CODE_COLOURS } from "@/theme/codeColours";

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  useCodeStore.setState({ history: [], colour: null });
});

describe("the create screen", () => {
  it("renders a code once there is something to encode", async () => {
    const { getByLabelText } = await renderWithProviders(<Create />);
    await fireEvent.changeText(
      getByLabelText(t("createLabel")),
      "https://example.com",
    );

    await waitFor(() =>
      expect(
        getByLabelText(t("codeFor", { text: "https://example.com" })),
      ).toBeTruthy(),
    );
  });

  it("renders nothing before anything is typed", async () => {
    const { queryByLabelText } = await renderWithProviders(<Create />);
    expect(queryByLabelText(t("codeFor", { text: "" }))).toBeNull();
  });

  it("tells a free user that batches are one at a time, and only encodes one", async () => {
    const { getByLabelText, getByText, queryByLabelText } =
      await renderWithProviders(<Create />);
    expect(getByText(t("batchLockedNote"))).toBeTruthy();

    await fireEvent.changeText(
      getByLabelText(t("createLabel")),
      "one\ntwo\nthree",
    );
    await waitFor(() =>
      expect(getByLabelText(t("codeFor", { text: "one" }))).toBeTruthy(),
    );
    expect(queryByLabelText(t("codeFor", { text: "two" }))).toBeNull();
  });

  it("encodes a whole batch for a paying user", async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText } = await renderWithProviders(<Create />);
    await fireEvent.changeText(
      getByLabelText(t("createLabel")),
      "one\ntwo\nthree",
    );

    await waitFor(() =>
      expect(getByLabelText(t("codeFor", { text: "three" }))).toBeTruthy(),
    );
  });

  it("sends a free user tapping a colour to the paywall, changing nothing", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const locked = CODE_COLOURS[0]!;
    const { getByLabelText } = await renderWithProviders(<Create />);

    await fireEvent.press(
      getByLabelText(`${locked.name} — ${t("lockedTitle")}`),
    );
    expect(alert.mock.calls[0]![0]).toBe(t("lockedTitle"));
    expect(useCodeStore.getState().colour).toBeNull();
  });

  it("lets a paying user pick a colour", async () => {
    usePremiumStore.setState({ isPremium: true });
    const chosen = CODE_COLOURS[1]!;
    const { getByLabelText } = await renderWithProviders(<Create />);

    await fireEvent.press(getByLabelText(chosen.name));
    expect(useCodeStore.getState().colour).toBe(chosen.value);
  });

  it("lets anyone go back to the default colour", async () => {
    useCodeStore.setState({ colour: CODE_COLOURS[0]!.value });
    const { getByLabelText } = await renderWithProviders(<Create />);
    await fireEvent.press(getByLabelText(t("colourDefault")));
    expect(useCodeStore.getState().colour).toBeNull();
    expect(testRouter.push).not.toHaveBeenCalledWith("/paywall");
  });

  it("warns when a chosen colour is too pale to scan", async () => {
    // A pale code looks completely fine and does not work. Saying so beats letting it print.
    usePremiumStore.setState({ isPremium: true });
    useCodeStore.setState({ colour: "#EEEEEE" });
    const { getByText } = await renderWithProviders(<Create />);
    expect(getByText(t("contrastWarning"))).toBeTruthy();
  });

  it("does not warn for a colour that is dark enough", async () => {
    usePremiumStore.setState({ isPremium: true });
    useCodeStore.setState({ colour: CODE_COLOURS[0]!.value });
    const { queryByText } = await renderWithProviders(<Create />);
    expect(queryByText(t("contrastWarning"))).toBeNull();
  });

  describe("saving a custom code to the photo library", () => {
    it("offers a save button once a code is rendered", async () => {
      const { getByLabelText, getByText } = await renderWithProviders(
        <Create />,
      );
      await fireEvent.changeText(
        getByLabelText(t("createLabel")),
        "https://example.com",
      );

      await waitFor(() => expect(getByText(t("saveCta"))).toBeTruthy());
    });

    it("captures the rendered code and writes it to the photo library, not the clipboard", async () => {
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const { getByLabelText, getByText } = await renderWithProviders(
        <Create />,
      );
      await fireEvent.changeText(
        getByLabelText(t("createLabel")),
        "https://example.com",
      );
      await waitFor(() => expect(getByText(t("saveCta"))).toBeTruthy());

      await fireEvent.press(getByText(t("saveCta")));

      await waitFor(() => expect(captureRef).toHaveBeenCalled());
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
        "file:///tmp/fake-code.png",
      );
      expect(alert).toHaveBeenCalledWith(t("savedToPhotos"));
    });

    it("asks first, and never writes, when photo library access is refused", async () => {
      (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce(
        {
          status: "denied",
        },
      );
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const { getByLabelText, getByText } = await renderWithProviders(
        <Create />,
      );
      await fireEvent.changeText(
        getByLabelText(t("createLabel")),
        "https://example.com",
      );
      await waitFor(() => expect(getByText(t("saveCta"))).toBeTruthy());

      await fireEvent.press(getByText(t("saveCta")));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(t("photoPermissionDenied")),
      );
      expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
    });

    it("reports failure rather than a false success when the capture throws", async () => {
      (captureRef as jest.Mock).mockRejectedValueOnce(
        new Error("no native view"),
      );
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const { getByLabelText, getByText } = await renderWithProviders(
        <Create />,
      );
      await fireEvent.changeText(
        getByLabelText(t("createLabel")),
        "https://example.com",
      );
      await waitFor(() => expect(getByText(t("saveCta"))).toBeTruthy());

      await fireEvent.press(getByText(t("saveCta")));

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(t("savePhotoFailed")),
      );
    });
  });
});
