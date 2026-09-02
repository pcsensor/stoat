import React from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from "react-native";
import { BORDER, PALETTE, SMALL_SHADOW } from "../ui/theme";

interface MarkdownTextProps {
  content: string;
  style?: TextStyle;
  resolveMention?: (userId: string) => string | undefined;
}

interface InlineToken {
  type: "text" | "bold" | "italic" | "strike" | "code" | "link" | "mention";
  content: string;
  extra?: string;
}

export function MarkdownText({ content, style, resolveMention }: MarkdownTextProps) {
  if (!content) return null;

  // 1. Split into top-level blocks (code blocks, blockquotes, paragraphs)
  const blocks = parseBlocks(content);

  return (
    <View style={styles.blockContainer}>
      {blocks.map((block, index) => {
        if (block.type === "code_block") {
          return (
            <View key={index} style={styles.codeBlock}>
              {block.language ? (
                <View style={styles.codeHeader}>
                  <Text style={styles.codeLang}>{block.language.toUpperCase()}</Text>
                </View>
              ) : null}
              <Text style={styles.codeContent} selectable>
                {block.content}
              </Text>
            </View>
          );
        }

        if (block.type === "quote") {
          return (
            <View key={index} style={styles.quoteBlock}>
              <Text style={[styles.bodyText, style]}>
                {renderInline(block.content, style, resolveMention)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={index} style={[styles.bodyText, style]}>
            {renderInline(block.content, style, resolveMention)}
          </Text>
        );
      })}
    </View>
  );
}

interface Block {
  type: "paragraph" | "code_block" | "quote";
  content: string;
  language?: string;
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let quoteLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
      paragraphLines = [];
    }
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      blocks.push({ type: "quote", content: quoteLines.join("\n") });
      quoteLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code fence ```
    const codeMatch = line.match(/^```(\w+)?\s*$/);
    if (codeMatch) {
      if (!inCode) {
        flushParagraph();
        flushQuote();
        inCode = true;
        codeLang = codeMatch[1] ?? "";
        codeLines = [];
      } else {
        inCode = false;
        blocks.push({
          type: "code_block",
          content: codeLines.join("\n"),
          language: codeLang || undefined,
        });
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Check blockquote >
    if (line.startsWith("> ") || line === ">") {
      flushParagraph();
      quoteLines.push(line.replace(/^>\s?/, ""));
      continue;
    } else if (quoteLines.length > 0) {
      flushQuote();
    }

    paragraphLines.push(line);
  }

  if (inCode && codeLines.length > 0) {
    blocks.push({
      type: "code_block",
      content: codeLines.join("\n"),
      language: codeLang || undefined,
    });
  }

  flushQuote();
  flushParagraph();

  return blocks;
}

function renderInline(
  text: string,
  baseStyle?: TextStyle,
  resolveMention?: (userId: string) => string | undefined
): React.ReactNode[] {
  const tokens = tokenizeInline(text);

  return tokens.map((token, index) => {
    switch (token.type) {
      case "bold":
        return (
          <Text key={index} style={[baseStyle, styles.bold]}>
            {token.content}
          </Text>
        );
      case "italic":
        return (
          <Text key={index} style={[baseStyle, styles.italic]}>
            {token.content}
          </Text>
        );
      case "strike":
        return (
          <Text key={index} style={[baseStyle, styles.strike]}>
            {token.content}
          </Text>
        );
      case "code":
        return (
          <Text key={index} style={styles.inlineCode}>
            {` ${token.content} `}
          </Text>
        );
      case "link":
        return (
          <Text
            key={index}
            style={styles.link}
            onPress={() => Linking.openURL(token.extra ?? token.content).catch(() => undefined)}
          >
            {token.content}
          </Text>
        );
      case "mention": {
        const username = resolveMention?.(token.extra ?? "") ?? token.content;
        return (
          <Text key={index} style={styles.mention}>
            {`@${username}`}
          </Text>
        );
      }
      default:
        return (
          <Text key={index} style={baseStyle}>
            {token.content}
          </Text>
        );
    }
  });
}

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(<@([0-9A-Z]{26})>)|(https?:\/\/[^\s]+)|(\*\*(.+?)\*\*)|(~~(.+?)~~)|(\*([^*]+?)\*)|(_([^_]+?)_)|(`([^`\n]+)`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Mention: <@ID>
      tokens.push({ type: "mention", content: match[2], extra: match[2] });
    } else if (match[3]) {
      // Link: https://...
      tokens.push({ type: "link", content: match[3], extra: match[3] });
    } else if (match[4]) {
      // Bold: **...**
      tokens.push({ type: "bold", content: match[5] });
    } else if (match[6]) {
      // Strike: ~~...~~
      tokens.push({ type: "strike", content: match[7] });
    } else if (match[8]) {
      // Italic: *...*
      tokens.push({ type: "italic", content: match[9] });
    } else if (match[10]) {
      // Italic: _..._
      tokens.push({ type: "italic", content: match[11] });
    } else if (match[12]) {
      // Inline code: `...`
      tokens.push({ type: "code", content: match[13] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

const styles = StyleSheet.create({
  blockContainer: { gap: 6 },
  bodyText: {
    color: PALETTE.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  bold: { fontWeight: "900" },
  italic: { fontStyle: "italic" },
  strike: { textDecorationLine: "line-through" },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: PALETTE.paperDeep,
    color: PALETTE.ink,
    borderWidth: 1,
    borderColor: PALETTE.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  link: {
    color: PALETTE.ink,
    textDecorationLine: "underline",
    fontWeight: "800",
    backgroundColor: PALETTE.cyan,
  },
  mention: {
    color: PALETTE.ink,
    backgroundColor: PALETTE.pink,
    fontWeight: "900",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: PALETTE.ink,
  },
  codeBlock: {
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.ink,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
    ...SMALL_SHADOW,
  },
  codeHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingBottom: 4,
    marginBottom: 6,
  },
  codeLang: {
    color: PALETTE.acid,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  codeContent: {
    fontFamily: "monospace",
    color: PALETTE.white,
    fontSize: 13,
    lineHeight: 18,
  },
  quoteBlock: {
    borderLeftWidth: 4,
    borderLeftColor: PALETTE.ink,
    paddingLeft: 10,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
});
