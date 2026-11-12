import type { Question } from "@circles/shared";
import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Text } from "../ui/Text";
import { radius, size, space, useTheme } from "../ui/theme";

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

type Layout = { y: number; height: number };

type Props = {
  questions: Question[];
  onEdit: (question: Question) => void;
  onRemove: (question: Question) => void;
  onMove: (from: number, to: number) => void;
  // While a row is held, so the screen stops scrolling under it.
  onDragging: (dragging: boolean) => void;
  // Left out once the event has as many questions as it may.
  onAdd?: () => void;
};

// One chalk list: a row per question with a handle to drag it up or down,
// and the row that adds one. The name is always asked and is not a row.
export function QuestionList({
  questions,
  onEdit,
  onRemove,
  onMove,
  onDragging,
  onAdd,
}: Props) {
  const { colors } = useTheme();
  const layouts = useRef(new Map<string, Layout>());

  // Where a row held `dy` below its place would land.
  function dropIndex(id: string, dy: number) {
    const from = layouts.current.get(id);
    if (!from) return undefined;
    const center = from.y + from.height / 2 + dy;
    for (let index = 0; index < questions.length; index++) {
      const layout = layouts.current.get(questions[index]!.id);
      if (layout && center < layout.y + layout.height) return index;
    }
    return questions.length - 1;
  }

  return (
    // Not clipped: a held row must stay in view past the card's edge.
    <Card list style={styles.unclipped}>
      {questions.map((question, index) => (
        <QuestionRow
          key={question.id}
          question={question}
          first={index === 0}
          last={index === questions.length - 1}
          onLayout={(event) =>
            layouts.current.set(question.id, {
              y: event.nativeEvent.layout.y,
              height: event.nativeEvent.layout.height,
            })
          }
          onEdit={() => onEdit(question)}
          onRemove={() => onRemove(question)}
          onStep={(by) => onMove(index, index + by)}
          onDragStart={() => onDragging(true)}
          onDragEnd={(dy) => {
            onDragging(false);
            const to = dropIndex(question.id, dy);
            if (to === undefined || to === index) return false;
            onMove(index, to);
            return true;
          }}
        />
      ))}
      {onAdd ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={onAdd}
            style={({ pressed }) => [
              styles.add,
              { borderColor: colors.input, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="plus" size={18} color={colors.foreground} />
            <Text variant="button">Add a question</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function QuestionRow({
  question,
  first,
  last,
  onLayout,
  onEdit,
  onRemove,
  onStep,
  onDragStart,
  onDragEnd,
}: {
  question: Question;
  first: boolean;
  last: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onEdit: () => void;
  onRemove: () => void;
  onStep: (by: -1 | 1) => void;
  onDragStart: () => void;
  // Whether the drop moved the row; if not, it springs back.
  onDragEnd: (dy: number) => boolean;
}) {
  const { colors } = useTheme();
  const [pan] = useState(() => new Animated.Value(0));
  const [lifted, setLifted] = useState(false);
  // Where the finger came down; read only inside the touch handlers.
  const startY = useRef(0);

  function settle(dy: number) {
    setLifted(false);
    if (onDragEnd(dy)) pan.setValue(0);
    else Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
  }

  const actions = [
    ...(first ? [] : [{ name: "moveUp", label: "Move up" }]),
    ...(last ? [] : [{ name: "moveDown", label: "Move down" }]),
  ];

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.row,
        // A lifted row covers the rows it passes over.
        lifted && [styles.lifted, { backgroundColor: colors.card }],
        { transform: [{ translateY: pan }, { scale: lifted ? 1.02 : 1 }] },
      ]}
    >
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          startY.current = event.nativeEvent.pageY;
          setLifted(true);
          onDragStart();
        }}
        onResponderMove={(event) =>
          pan.setValue(event.nativeEvent.pageY - startY.current)
        }
        onResponderRelease={(event) =>
          settle(event.nativeEvent.pageY - startY.current)
        }
        onResponderTerminate={(event) =>
          settle(event.nativeEvent.pageY - startY.current)
        }
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${question.title}`}
        accessibilityActions={actions}
        onAccessibilityAction={(event) =>
          onStep(event.nativeEvent.actionName === "moveUp" ? -1 : 1)
        }
        style={styles.handle}
      >
        <Icon name="grip" size={18} color={colors.textMuted} />
      </View>
      <Text variant="headline" style={styles.text}>
        {question.title}
      </Text>
      <View style={styles.actions}>
        <IconButton
          icon="pencil"
          label={`Edit ${question.title}`}
          onPress={onEdit}
        />
        <IconButton
          icon="xmark"
          label={`Remove ${question.title}`}
          onPress={onRemove}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  unclipped: { overflow: "visible" },
  // The glyphs at either end sit where the Who's in list puts its own.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingRight: space.xs,
    paddingVertical: space.md,
    zIndex: 0,
  },
  lifted: { zIndex: 10 },
  // The drag handle is a full-size target.
  handle: {
    width: size.control,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center" },
  footer: { padding: space.md },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: size.control,
    borderWidth: 1.2,
    borderStyle: "dashed",
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
  },
});
