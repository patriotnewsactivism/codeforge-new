import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type Project = {
  _id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  language?: string;
  lastOpenedAt: number;
  _creationTime: number;
};

type ModalMode = "none" | "create" | "import";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getLangColor(lang?: string): string {
  const map: Record<string, string> = {
    typescript: "#3178C6",
    javascript: "#F7DF1E",
    python: "#3776AB",
    rust: "#CE422B",
    go: "#00ACD7",
    html: "#E34F26",
    css: "#264DE4",
  };
  if (!lang) return "#868699";
  return map[lang.toLowerCase()] ?? "#868699";
}

function parseRepo(input: string): string | null {
  input = input.trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return input;
  const match = input.match(/github\.com\/([^/]+\/[^/\s]+?)(?:\.git)?(?:\/.*)?$/);
  return match ? match[1]! : null;
}

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const projects = useQuery(api.projects.list) as Project[] | undefined;
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const importFromGitHub = useAction(api.git.importFromGitHub);

  const [modal, setModal] = useState<ModalMode>("none");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const closeModal = () => {
    setModal("none");
    setNewName("");
    setNewDesc("");
    setRepoUrl("");
    setImportName("");
    setImportStatus("idle");
    setImportMsg("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const id = await createProject({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      closeModal();
      router.push(`/project/${id}`);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    const repoFullName = parseRepo(repoUrl);
    if (!repoFullName) {
      setImportStatus("error");
      setImportMsg("Enter a valid GitHub URL or owner/repo");
      return;
    }
    const name = importName.trim() || repoFullName.split("/")[1] || repoFullName;
    setImportStatus("importing");
    setImportMsg("Creating project...");
    try {
      const projectId = await createProject({
        name,
        description: `Imported from github.com/${repoFullName}`,
        githubRepo: repoFullName,
      });
      setImportMsg(`Fetching files from ${repoFullName}...`);
      const result = await importFromGitHub({ projectId: projectId as any, repoFullName });
      if (!(result as any).success) {
        setImportStatus("error");
        setImportMsg((result as any).error ?? "Import failed");
        await removeProject({ projectId: projectId as any });
        return;
      }
      setImportStatus("done");
      setImportMsg(`Imported ${(result as any).filesImported} files`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        closeModal();
        router.push(`/project/${projectId}`);
      }, 1200);
    } catch (e) {
      setImportStatus("error");
      setImportMsg(e instanceof Error ? e.message : "Import failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDelete = (project: Project) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Project",
      `Delete "${project.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeProject({ projectId: project._id as any });
          },
        },
      ],
    );
  };

  const loading = projects === undefined;

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
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Projects
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModal("import");
            }}
          >
            <Feather name="github" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModal("create");
            }}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(projects && projects.length > 0)}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name="folder"
                size={48}
                color={colors.mutedForeground}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No projects yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap + to create or import from GitHub
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/project/${item._id}`);
              }}
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.langDot,
                    { backgroundColor: getLangColor(item.language) },
                  ]}
                />
                <View style={styles.cardInfo}>
                  <Text
                    style={[styles.cardName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text
                      style={[styles.cardDesc, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    {item.githubRepo ? (
                      <View style={styles.metaItem}>
                        <Feather name="github" size={11} color={colors.mutedForeground} />
                        <Text
                          style={[styles.metaText, { color: colors.mutedForeground }]}
                          numberOfLines={1}
                        >
                          {item.githubRepo}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {timeAgo(item.lastOpenedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={modal === "create"} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Project</Text>

          <View style={styles.sheetField}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              style={[styles.sheetInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              placeholder="My awesome project"
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
          </View>

          <View style={styles.sheetField}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Description (optional)</Text>
            <TextInput
              style={[styles.sheetInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              placeholder="What are you building?"
              placeholderTextColor={colors.mutedForeground}
              value={newDesc}
              onChangeText={setNewDesc}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              { backgroundColor: newName.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.sheetBtnText, { color: newName.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                Create Project
              </Text>
            )}
          </Pressable>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal visible={modal === "import"} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetTitleRow}>
            <Feather name="github" size={20} color={colors.foreground} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Import from GitHub</Text>
          </View>

          <View style={styles.sheetField}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Repository URL or owner/repo</Text>
            <TextInput
              style={[styles.sheetInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              placeholder="https://github.com/owner/repo"
              placeholderTextColor={colors.mutedForeground}
              value={repoUrl}
              onChangeText={setRepoUrl}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <View style={styles.sheetField}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Project name (optional)</Text>
            <TextInput
              style={[styles.sheetInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Leave blank to use repo name"
              placeholderTextColor={colors.mutedForeground}
              value={importName}
              onChangeText={setImportName}
            />
          </View>

          {importStatus !== "idle" ? (
            <View style={[
              styles.importStatus,
              {
                backgroundColor: importStatus === "error" ? colors.destructive + "22" : importStatus === "done" ? colors.success + "22" : colors.primary + "11",
                borderColor: importStatus === "error" ? colors.destructive + "55" : importStatus === "done" ? colors.success + "55" : colors.primary + "33",
              }
            ]}>
              {importStatus === "importing" ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Feather
                  name={importStatus === "done" ? "check-circle" : "alert-circle"}
                  size={16}
                  color={importStatus === "done" ? colors.success : colors.destructive}
                />
              )}
              <Text style={[
                styles.importStatusText,
                { color: importStatus === "error" ? colors.destructive : importStatus === "done" ? colors.success : colors.primary }
              ]}>
                {importMsg}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              { backgroundColor: repoUrl.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleImport}
            disabled={!repoUrl.trim() || importStatus === "importing" || importStatus === "done"}
          >
            {importStatus === "importing" ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.sheetBtnText, { color: repoUrl.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                Import Repository
              </Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
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
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  cardMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  sheetField: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sheetInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sheetBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sheetBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  importStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  importStatusText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
