import { AREAS, type AreaId } from "@circles/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { font, radius, size, space, useTheme } from "../ui/theme";

export type LocationResult = { id: AreaId; name: string; detail: string };

// Where the picker's places come from. Today that's the fixed areas; a Places
// search can stand behind the same shape later.
export type LocationSource = {
  key: string;
  search(query: string): Promise<LocationResult[]>;
};

export const areasSource: LocationSource = {
  key: "areas",
  async search(query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return AREAS.filter((area) =>
      words.every((word) => area.name.toLowerCase().includes(word)),
    ).map((area) => ({
      id: area.id,
      name: area.name,
      detail: `Within ${area.radiusKm} km`,
    }));
  },
};

export function LocationPicker({
  value,
  onChange,
  source = areasSource,
  error,
}: {
  value: AreaId;
  onChange: (id: AreaId) => void;
  source?: LocationSource;
  error?: string;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const results = useQuery({
    queryKey: ["locations", source.key, query],
    queryFn: () => source.search(query),
    placeholderData: keepPreviousData,
  });
  const found = results.data ?? [];

  return (
    <View style={styles.picker}>
      <View style={[styles.search, { backgroundColor: colors.surface }]}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search areas"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search areas"
          autoCorrect={false}
          returnKeyType="search"
          maxFontSizeMultiplier={1.5}
          style={[styles.input, { color: colors.foreground }]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={space.sm}
            onPress={() => setQuery("")}
          >
            <Icon name="xmark" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {results.isError ? (
        <Text color="danger">Can’t search right now</Text>
      ) : found.length === 0 && results.isFetched ? (
        <Text color="textMuted" style={styles.empty}>
          No areas match “{query.trim()}”
        </Text>
      ) : (
        <View style={styles.rows}>
          {found.map((place) => {
            const selected = place.id === value;
            return (
              <Pressable
                key={place.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${place.name}, ${place.detail}`}
                onPress={() => onChange(place.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.pin, { backgroundColor: colors.background }]}
                >
                  <Icon name="map-pin" size={18} color={colors.foreground} />
                </View>
                <View style={styles.text}>
                  <Text variant="headline" numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text color="textMuted" numberOfLines={1}>
                    {place.detail}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    selected
                      ? { backgroundColor: colors.primary }
                      : { borderWidth: 1.5, borderColor: colors.border },
                  ]}
                >
                  {selected ? (
                    <Icon
                      name="check"
                      size={14}
                      color={colors.primaryForeground}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: size.control,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
  },
  input: {
    flex: 1,
    minHeight: size.control,
    fontFamily: font.regular,
    fontSize: 17,
  },
  empty: { paddingHorizontal: space.xs },
  rows: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pin: {
    width: size.small,
    height: size.small,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
