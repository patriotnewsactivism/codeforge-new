import { useAuthActions } from "@convex-dev/auth/react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "convex/react";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type User = {
  _id: string;
  email?: string;
  name?: string;
};

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.currentUser) as User | null | undefined;

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const initials = (() => {
    const name = user?.name || user?.email;
    if (!name) return "?";
    const parts = name.split(/[\s@]/);
    return parts
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("");
  })();

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    danger,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed && onPress ? 0.7 : 1,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: danger
              ? colors.destructive + "22"
              : colors.secondary,
          },
        ]}
      >
        <Feather
          name={icon as any}
          size={16}
          color={danger ? colors.destructive : colors.mutedForeground}
        />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text
            style={[styles.rowValue, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {onPress ? (
          <Feather
            name="chevron-right"
            size={16}
            color={colors.mutedForeground}
          />
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopPad + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + "33" },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initials}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {user?.name ? (
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {user.name}
              </Text>
            ) : null}
            <Text
              style={[styles.profileEmail, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {user?.email ?? "Loading..."}
            </Text>
          </View>
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Account
          </Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="mail"
              label="Email"
              value={user?.email}
            />
            <SettingRow
              icon="shield"
              label="Plan"
              value="Free"
            />
          </View>
        </View>

        {/* App section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            App
          </Text>
          <View style={styles.sectionContent}>
            <SettingRow icon="info" label="Version" value="1.0.0" />
            <SettingRow
              icon="globe"
              label="Powered by"
              value="Convex + AI"
            />
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="log-out"
              label="Sign Out"
              onPress={handleSignOut}
              danger
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  section: { gap: 8, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  sectionContent: {
    borderRadius: 14,
    overflow: "hidden",
    gap: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 160,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
