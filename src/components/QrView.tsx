import React from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useTheme } from "@/theme";

interface QrViewProps {
  /** `true` is a dark module. */
  matrix: boolean[][];
  size: number;
  /** Module colour. Falls back to the theme's ink. */
  colour?: string | null;
  /** Quiet-zone and background colour. */
  background?: string;
}

/**
 * A QR code drawn as vectors.
 *
 * Drawn rather than tinted: the modules are rendered in the chosen colour from the start, so
 * a coloured code is a real code and not a scannable one with a filter over it. That is also
 * why this takes a matrix rather than an image — an image can only be recoloured, and
 * recolouring is what breaks contrast without anyone noticing.
 *
 * The quiet zone is four modules, as the spec requires. Codes fail to scan far more often
 * because something was drawn right up to the edge than because of anything inside them.
 */
export function QrView({ matrix, size, colour, background }: QrViewProps) {
  const { colors } = useTheme();
  const modules = matrix.length;
  if (modules === 0) return null;

  const quiet = 4;
  const total = modules + quiet * 2;
  const cell = size / total;
  const ink = colour ?? colors.text;
  const paper = background ?? colors.onAccent;

  return (
    <View
      accessible
      accessibilityRole="image"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={paper} />
        {matrix.map((row, y) =>
          row.map((dark, x) =>
            dark ? (
              <Rect
                key={`${x}-${y}`}
                x={(x + quiet) * cell}
                y={(y + quiet) * cell}
                // A hair of overlap, so antialiasing between adjacent modules cannot leave
                // pale seams that a scanner reads as light.
                width={cell + 0.5}
                height={cell + 0.5}
                fill={ink}
              />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
}
