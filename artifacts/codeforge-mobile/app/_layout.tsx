import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { api } from "@/lib/api";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL as string;

const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function handleDeepLinkUrl(url: string | null, router: ReturnType<typeof useRouter>) {
  if (!url) return;
  try {
    const parsed = Linking.parse(url);
    // codeforge-mobile://project/<id>  →  hostname="project", path="<id>"
    if (parsed.hostname === "project" && parsed.path) {
      router.push({ pathname: "/project/[id]", params: { id: parsed.path } });
    }
  } catch {
    // ignore malformed URLs
  }
}

function NotificationSetup() {
  const { isAuthenticated } = useConvexAuth();
  const registerToken = useMutation(api.users.registerPushToken);
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Deep link handling: cold-start URL + warm-start URL events
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Cold start: app opened via a deep link while not running
    Linking.getInitialURL().then(url => handleDeepLinkUrl(url, router)).catch(console.warn);

    // Warm start: app already running and receives a deep link
    const linkingSub = Linking.addEventListener("url", ({ url }) => handleDeepLinkUrl(url, router));

    return () => linkingSub.remove();
  }, [router]);

  // Notification tap → deep link into the project screen
  useEffect(() => {
    if (Platform.OS === "web") return;

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      const url = data?.url;
      if (url) {
        handleDeepLinkUrl(url, router);
      } else if (data?.projectId) {
        router.push({ pathname: "/project/[id]", params: { id: data.projectId } });
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;

    let cancelled = false;

    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted" || cancelled) return;

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (cancelled) return;
        const platform = Platform.OS === "ios" ? "ios" : "android";
        await registerToken({ token: tokenData.data, platform });
      } catch (err) {
        console.warn("Push token registration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, registerToken]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationSetup />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!convex) {
    const { View, Text } = require("react-native");
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#161622", padding: 24 }}>
        <Text style={{ color: "#3DD6C8", fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>
          CodeForge
        </Text>
        <Text style={{ color: "#868699", textAlign: "center", fontSize: 14 }}>
          Set EXPO_PUBLIC_CONVEX_URL to connect to your Convex backend.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {/* @ts-ignore — storage prop accepts async adapter */}
        <ConvexAuthProvider client={convex} storage={storage}>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ConvexAuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
