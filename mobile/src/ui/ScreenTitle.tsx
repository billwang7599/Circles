import { Text } from "./Text";

// An inner screen's title, placed in its content; the system header shows
// only the back or close control.
export function ScreenTitle({ title }: { title: string }) {
  return (
    <Text variant="title" accessibilityRole="header">
      {title}
    </Text>
  );
}
