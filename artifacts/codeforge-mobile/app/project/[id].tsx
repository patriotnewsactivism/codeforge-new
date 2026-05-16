import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type FileItem = {
  _id: string;
  name: string;
  path: string;
  language?: string;
  isDirectory: boolean;
  content: string;
};

type ChatMessage = {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  _creationTime: number;
};

type TabType = "files" | "chat";

const LANG_ICONS: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  rust: "rs",
  go: "go",
  html: "html",
  css: "css",
  json: "json",
  markdown: "md",
};

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabType>("files");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingContent, setEditingContent] = useState("");
  const [saving, setSaving] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const currentUser = useQuery(api.auth.currentUser);
  const project = useQuery(api.projects.get, id ? { projectId: id as any } : "skip");
  const files = useQuery(api.files.listByProject, id ? { projectId: id as any } : "skip") as FileItem[] | undefined;
  const sessions = useQuery(api.chat.listSessions, id ? { projectId: id as any } : "skip") as any[] | undefined;
  const getOrCreateSession = useMutation(api.chat.getOrCreateSession);
  const sendMessageAction = useAction(api.chat.sendMessage);
  const updateContent = useMutation(api.files.updateContent);

  const latestSession = sessions?.[0];
  const messages = useQuery(
    api.chat.listMessages,
    latestSession?._id ? { sessionId: latestSession._id as any } : "skip"
  ) as ChatMessage[] | undefined;

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const handleSend = async () => {
    if (!chatInput.trim() || !id || !currentUser?._id) return;
    const text = chatInput.trim();
    setChatInput("");
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const sessionId = latestSession?._id
        ? (latestSession._id as any)
        : await getOrCreateSession({ projectId: id as any, model: "deepseek-v4-flash" });
      await sendMessageAction({
        sessionId,
        projectId: id as any,
        content: text,
        model: "deepseek-v4-flash",
        userId: currentUser._id as any,
      });
    } catch (err) {
      console.error("Chat send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateContent({ fileId: selectedFile._id as any, content: editingContent });
      setSelectedFile({ ...selectedFile, content: editingContent });
      setEditMode(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Save failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const dirFiles = files?.filter((f) => !f.isDirectory) ?? [];
  const dirs = files?.filter((f) => f.isDirectory) ?? [];
  const allFiles = [...dirs, ...dirFiles];

  if (project === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (project === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopPad + 4,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {project.name}
          </Text>
          {project.githubRepo ? (
            <View style={styles.repoRow}>
              <Feather name="github" size={11} color={colors.mutedForeground} />
              <Text
                style={[styles.repoText, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {project.githubRepo}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View
        style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
      >
        {(["files", "chat"] as TabType[]).map((t) => (
          <Pressable
            key={t}
            style={[
              styles.tabBtn,
              {
                borderBottomColor:
                  tab === t ? colors.primary : "transparent",
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => {
              setTab(t);
              setSelectedFile(null);
            }}
          >
            <Feather
              name={t === "files" ? "folder" : "message-square"}
              size={15}
              color={tab === t ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: tab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t === "files" ? "Files" : "Chat"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Files Tab */}
      {tab === "files" && !selectedFile && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.fileList,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {files === undefined ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : allFiles.length === 0 ? (
            <View style={styles.emptyFiles}>
              <Feather
                name="folder-plus"
                size={36}
                color={colors.mutedForeground}
                style={{ marginBottom: 10 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No files yet
              </Text>
              <Text
                style={[styles.emptyDesc, { color: colors.mutedForeground }]}
              >
                Use the Chat tab to ask AI to build your project
              </Text>
            </View>
          ) : (
            allFiles.map((file) => (
              <Pressable
                key={file._id}
                style={({ pressed }) => [
                  styles.fileRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  if (!file.isDirectory) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedFile(file);
                  }
                }}
              >
                <Feather
                  name={file.isDirectory ? "folder" : "file-text"}
                  size={16}
                  color={
                    file.isDirectory ? colors.warning : colors.mutedForeground
                  }
                />
                <Text
                  style={[styles.fileName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {file.path}
                </Text>
                {!file.isDirectory && file.language ? (
                  <View
                    style={[
                      styles.langBadge,
                      { backgroundColor: colors.secondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langBadgeText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {LANG_ICONS[file.language.toLowerCase()] ??
                        file.language.slice(0, 4)}
                    </Text>
                  </View>
                ) : null}
                {!file.isDirectory && (
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.mutedForeground}
                  />
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* File Viewer */}
      {tab === "files" && selectedFile && (
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.fileViewerHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => {
                setSelectedFile(null);
                setEditMode(false);
                setEditingContent("");
              }}
              style={styles.fileViewerBack}
            >
              <Feather name="arrow-left" size={14} color={colors.primary} />
              <Text style={[styles.fileViewerBackText, { color: colors.primary }]}>
                Files
              </Text>
            </Pressable>
            <Text
              style={[styles.fileViewerName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {selectedFile.name}
            </Text>
            {editMode ? (
              <View style={styles.fileViewerActions}>
                <Pressable
                  style={[styles.fileActionBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditMode(false); setEditingContent(""); }}
                >
                  <Text style={[styles.fileActionText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.fileActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={handleSaveFile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={[styles.fileActionText, { color: colors.primaryForeground }]}>Save</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.editBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setEditingContent(selectedFile.content || "");
                  setEditMode(true);
                }}
              >
                <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          {editMode ? (
            <TextInput
              style={[styles.codeEditor, { color: colors.foreground, backgroundColor: colors.background }]}
              value={editingContent}
              onChangeText={setEditingContent}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              textAlignVertical="top"
            />
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.codeContent}
              horizontal={false}
              showsVerticalScrollIndicator={true}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <Text
                  style={[styles.codeText, { color: colors.foreground }]}
                  selectable
                >
                  {selectedFile.content || "(empty file)"}
                </Text>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      )}

      {/* Chat Tab */}
      {tab === "chat" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatRef}
            data={[...(messages ?? [])].reverse()}
            inverted
            keyExtractor={(item) => item._id}
            contentContainerStyle={[
              styles.messageList,
              {
                paddingBottom: 8,
              },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!(messages && messages.length > 0)}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Feather
                  name="message-square"
                  size={36}
                  color={colors.mutedForeground}
                  style={{ marginBottom: 10 }}
                />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Start a conversation
                </Text>
                <Text
                  style={[styles.emptyDesc, { color: colors.mutedForeground }]}
                >
                  Ask AI to build, fix, or explain your code
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              return (
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    {
                      backgroundColor: isUser
                        ? colors.primary + "22"
                        : colors.card,
                      borderColor: isUser
                        ? colors.primary + "44"
                        : colors.border,
                      alignSelf: isUser ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  {!isUser && (
                    <View style={[styles.aiTag, { backgroundColor: colors.primary + "22" }]}>
                      <Feather name="zap" size={10} color={colors.primary} />
                      <Text style={[styles.aiTagText, { color: colors.primary }]}>
                        {item.model ?? "AI"}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      { color: isUser ? colors.foreground : colors.foreground },
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>
              );
            }}
          />

          {/* Chat input */}
          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
              },
            ]}
          >
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[styles.chatInput, { color: colors.foreground }]}
                placeholder="Ask AI anything about your project..."
                placeholderTextColor={colors.mutedForeground}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={2000}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: chatInput.trim()
                      ? colors.primary
                      : colors.muted,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={handleSend}
                disabled={!chatInput.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator
                    color={colors.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Feather
                    name="send"
                    size={14}
                    color={
                      chatInput.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground
                    }
                  />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  repoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  repoText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  fileList: {
    padding: 16,
    gap: 8,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  langBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  emptyFiles: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyChat: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  fileViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fileViewerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fileViewerBackText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  fileViewerName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  fileViewerActions: {
    flexDirection: "row",
    gap: 6,
  },
  fileActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fileActionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  codeEditor: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
    padding: 16,
  },
  codeContent: {
    padding: 16,
  },
  codeText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  userBubble: {},
  aiBubble: {},
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiTagText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
