import { useCallback, useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { Doc } from "../../../convex/_generated/dataModel";

interface CodeEditorProps {
  file: Doc<"files"> | null;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function CodeEditor({ file, onChange, onSave }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });

      monaco.editor.defineTheme("codeforge-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955" },
          { token: "keyword", foreground: "C586C0" },
          { token: "string", foreground: "CE9178" },
          { token: "number", foreground: "B5CEA8" },
          { token: "type", foreground: "4EC9B0" },
          { token: "function", foreground: "DCDCAA" },
          { token: "variable", foreground: "9CDCFE" },
        ],
        colors: {
          "editor.background": "#0d0f1a",
          "editor.foreground": "#e0e0e0",
          "editor.lineHighlightBackground": "#1a1d2e",
          "editor.selectionBackground": "#264f78",
          "editorCursor.foreground": "#22d3ee",
          "editorLineNumber.foreground": "#4a4a5a",
          "editorLineNumber.activeForeground": "#22d3ee",
          "editor.selectionHighlightBackground": "#1a3a5c",
          "editorIndentGuide.background": "#1a1d2e",
          "editorIndentGuide.activeBackground": "#2a2d3e",
        },
      });
      monaco.editor.setTheme("codeforge-dark");

      // Don't auto-focus on mobile — it pops the keyboard immediately
      const isMobile = window.innerWidth < 768;
      if (!isMobile) editor.focus();
    },
    [onSave]
  );

  useEffect(() => {
    if (editorRef.current && file) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== file.content) {
        editorRef.current.setValue(file.content);
      }
    }
  }, [file?._id]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-[oklch(0.13_0.02_260)]">
        <div className="text-center px-4">
          <div className="text-4xl mb-4 opacity-20">{"</>"}</div>
          <p className="text-muted-foreground text-sm">Select a file to start editing</p>
          <p className="text-muted-foreground/60 text-xs mt-1">or create a new one from the file tree</p>
        </div>
      </div>
    );
  }

  const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    // CRITICAL: overflow-hidden prevents Monaco from expanding the page width on mobile
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={file.language ?? "plaintext"}
        value={file.content}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleEditorMount}
        theme="codeforge-dark"
        options={{
          fontSize: isMobileScreen ? 12 : 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
          fontLigatures: !isMobileScreen,
          minimap: { enabled: false },
          lineNumbers: isMobileScreen ? "off" : "on",
          renderLineHighlight: "line",
          scrollBeyondLastLine: false,
          // CRITICAL: wordWrap on prevents horizontal scroll on mobile
          wordWrap: "on",
          wrappingStrategy: "advanced",
          tabSize: 2,
          insertSpaces: true,
          // CRITICAL: automaticLayout makes Monaco fit its container
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: !isMobileScreen, indentation: !isMobileScreen },
          // Mobile: disable heavy features for performance
          renderWhitespace: "none",
          occurrencesHighlight: isMobileScreen ? "off" : "singleFile",
          folding: !isMobileScreen,
          glyphMargin: false,
          lineDecorationsWidth: isMobileScreen ? 0 : 10,
          overviewRulerLanes: isMobileScreen ? 0 : 3,
          scrollbar: {
            vertical: "auto",
            horizontal: "hidden", // CRITICAL: no horizontal scrollbar on mobile
            useShadows: false,
          },
        }}
      />
    </div>
  );
}
